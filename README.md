# Stock Barrio (MVP)

App web responsiva (JavaScript + Vite) con Supabase (Auth + Postgres) y despliegue en Vercel.

## Puesta en marcha

1. Instalar Node.js LTS (https://nodejs.org) y abrir una terminal nueva.
2. `npm install`
3. En Supabase: crear un proyecto y ejecutar `supabase/schema.sql` en el SQL Editor.
4. Copiar `.env.example` a `.env` y completar la URL y la clave **anon** del proyecto (Settings → API). No subir `.env` a ningún repositorio.
5. Crear las cuentas de prueba (Authentication → Users) y asociarlas a un comercio (ver el final de `schema.sql`).
6. `npm run dev` para probar localmente; `npm run build` para generar `dist/`.

## Despliegue en Vercel

Importar el proyecto, framework **Vite**, y definir las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Usar proyectos Supabase distintos para desarrollo, certificación y producción (un entorno de Vercel por cada uno).

## Pantallas

Login · Resumen · Productos (lista, nuevo, editar) · Movimientos (Venta | Compra | Historial) · Historial (Ver / Editar) · Alertas e informes.

## Decisiones tomadas por defecto (pendientes de aprobación del equipo)

- Alerta con `stock <= mínimo`: se cambia en `ALERTA_INCLUYE_IGUALDAD` ([src/api.js](src/api.js)).
- Los productos no se borran (columna `activo`).
- Editar un movimiento permite cambiar cantidad, fecha y nota; el stock se recalcula con la diferencia y no puede quedar negativo.
- Se retiró el tipo «Ajuste» de la interfaz y de la base de datos (ver observaciones en el chat).
