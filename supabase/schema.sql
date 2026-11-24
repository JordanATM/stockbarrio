-- Stock Barrio MVP · esquema de Supabase
-- Ejecutar completo en el SQL Editor de Supabase.

create extension if not exists pgcrypto;

-- ───────── Tablas ─────────
create table public.comercios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

-- Una cuenta (auth.users) pertenece a un solo comercio.
-- En el MVP las cuentas y esta asociación las crea el equipo manualmente.
create table public.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  comercio_id uuid not null references public.comercios(id)
);

create or replace function public.mi_comercio()
returns uuid
language sql stable security definer set search_path = public
as $$ select comercio_id from public.perfiles where user_id = auth.uid() $$;

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null default public.mi_comercio() references public.comercios(id),
  nombre text not null check (length(trim(nombre)) > 0),
  stock_minimo integer not null default 0 check (stock_minimo >= 0),
  stock_actual integer not null default 0 check (stock_actual >= 0),
  activo boolean not null default true,   -- no se borra: se desactiva para conservar historial
  created_at timestamptz not null default now()
);

create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id),
  producto_id uuid not null references public.productos(id),
  tipo text not null check (tipo in ('compra', 'venta')),
  cantidad integer not null check (cantidad > 0),
  fecha date not null default current_date,
  nota text,
  created_at timestamptz not null default now(),
  editado_at timestamptz
);
create index on public.movimientos (comercio_id, fecha desc, created_at desc);
create index on public.productos (comercio_id);

-- ───────── Seguridad (RLS): cada cuenta solo ve su comercio ─────────
alter table public.comercios   enable row level security;
alter table public.perfiles    enable row level security;
alter table public.productos   enable row level security;
alter table public.movimientos enable row level security;

create policy comercios_sel on public.comercios   for select to authenticated using (id = public.mi_comercio());
create policy perfiles_sel  on public.perfiles    for select to authenticated using (user_id = auth.uid());
create policy productos_sel on public.productos   for select to authenticated using (comercio_id = public.mi_comercio());
create policy productos_ins on public.productos   for insert to authenticated with check (comercio_id = public.mi_comercio());
create policy productos_upd on public.productos   for update to authenticated
  using (comercio_id = public.mi_comercio()) with check (comercio_id = public.mi_comercio());
create policy movimientos_sel on public.movimientos for select to authenticated using (comercio_id = public.mi_comercio());

revoke all on public.comercios, public.perfiles, public.productos, public.movimientos from anon, authenticated;
grant select on public.comercios, public.perfiles, public.productos, public.movimientos to authenticated;
-- El cliente puede crear productos (con stock inicial) y editar nombre/mínimo/estado.
-- El stock_actual solo cambia mediante las funciones de movimientos.
grant insert (nombre, stock_minimo, stock_actual) on public.productos to authenticated;
grant update (nombre, stock_minimo, activo)       on public.productos to authenticated;
grant execute on function public.mi_comercio() to authenticated;

-- ───────── Movimientos atómicos: movimiento y stock se confirman juntos ─────────
create or replace function public.registrar_movimiento(
  p_producto uuid, p_tipo text, p_cantidad integer,
  p_fecha date default current_date, p_nota text default null)
returns public.movimientos
language plpgsql security definer set search_path = public
as $$
declare
  v_com uuid := public.mi_comercio();
  v_prod public.productos;
  v_nuevo integer;
  v_mov public.movimientos;
begin
  if v_com is null then raise exception 'La cuenta no tiene un comercio asociado'; end if;
  if p_tipo not in ('compra', 'venta') then raise exception 'Tipo de movimiento inválido'; end if;
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'La cantidad debe ser un entero mayor que cero'; end if;

  select * into v_prod from public.productos
   where id = p_producto and comercio_id = v_com and activo for update;
  if not found then raise exception 'Producto no encontrado'; end if;

  v_nuevo := v_prod.stock_actual + case when p_tipo = 'compra' then p_cantidad else -p_cantidad end;
  if v_nuevo < 0 then raise exception 'Stock insuficiente: hay % unidades disponibles', v_prod.stock_actual; end if;

  update public.productos set stock_actual = v_nuevo where id = v_prod.id;
  insert into public.movimientos (comercio_id, producto_id, tipo, cantidad, fecha, nota)
  values (v_com, v_prod.id, p_tipo, p_cantidad, coalesce(p_fecha, current_date), nullif(trim(p_nota), ''))
  returning * into v_mov;
  return v_mov;
end $$;

-- Editar un movimiento: corrige cantidad, fecha o nota. El stock se recalcula con la diferencia.
create or replace function public.editar_movimiento(
  p_id uuid, p_cantidad integer, p_fecha date, p_nota text default null)
returns public.movimientos
language plpgsql security definer set search_path = public
as $$
declare
  v_com uuid := public.mi_comercio();
  v_mov public.movimientos;
  v_prod public.productos;
  v_nuevo integer;
  v_signo integer;
begin
  if v_com is null then raise exception 'La cuenta no tiene un comercio asociado'; end if;
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'La cantidad debe ser un entero mayor que cero'; end if;

  select * into v_mov from public.movimientos where id = p_id and comercio_id = v_com for update;
  if not found then raise exception 'Movimiento no encontrado'; end if;
  select * into v_prod from public.productos where id = v_mov.producto_id for update;

  v_signo := case when v_mov.tipo = 'compra' then 1 else -1 end;
  v_nuevo := v_prod.stock_actual + v_signo * (p_cantidad - v_mov.cantidad);
  if v_nuevo < 0 then raise exception 'La edición dejaría el stock en negativo (stock actual: %)', v_prod.stock_actual; end if;

  update public.productos set stock_actual = v_nuevo where id = v_prod.id;
  update public.movimientos
     set cantidad = p_cantidad, fecha = coalesce(p_fecha, fecha),
         nota = nullif(trim(p_nota), ''), editado_at = now()
   where id = v_mov.id
  returning * into v_mov;
  return v_mov;
end $$;

revoke execute on function public.registrar_movimiento(uuid, text, integer, date, text) from public, anon;
revoke execute on function public.editar_movimiento(uuid, integer, date, text) from public, anon;
grant execute on function public.registrar_movimiento(uuid, text, integer, date, text) to authenticated;
grant execute on function public.editar_movimiento(uuid, integer, date, text) to authenticated;

-- ───────── Datos ficticios de prueba (opcional) ─────────
-- 1) Crea dos usuarios en Authentication → Users (Comercio A y Comercio B).
-- 2) Ejecuta, reemplazando los UUID de cada usuario:
--   insert into comercios (nombre) values ('Comercio A') returning id;  -- anota el id
--   insert into perfiles (user_id, comercio_id) values ('<uuid-usuario-A>', '<id-comercio-A>');
-- 3) Inicia sesión con esa cuenta y crea Aceite 1 L (mín. 6, stock 3) y Arroz 1 kg (mín. 8, stock 18).
