import { supabase } from './supabase.js'

function ok({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

// Regla de alerta (decisión pendiente en el plan de pruebas):
// true  → alerta con stock <= mínimo ; false → alerta solo con stock < mínimo.
export const ALERTA_INCLUYE_IGUALDAD = true
export const bajoMinimo = (p) =>
  ALERTA_INCLUYE_IGUALDAD ? p.stock_actual <= p.stock_minimo : p.stock_actual < p.stock_minimo

// Sesión
export const iniciarSesion = async (email, password) =>
  ok(await supabase.auth.signInWithPassword({ email, password }))
export const cerrarSesion = () => supabase.auth.signOut()
export const obtenerSesion = async () => (await supabase.auth.getSession()).data.session

// Productos
export const listarProductos = async () =>
  ok(await supabase.from('productos').select('*').eq('activo', true).order('nombre'))
export const obtenerProducto = async (id) =>
  ok(await supabase.from('productos').select('*').eq('id', id).single())
export const crearProducto = async ({ nombre, stock_minimo, stock_actual }) =>
  ok(await supabase.from('productos').insert({ nombre, stock_minimo, stock_actual }).select().single())
export const editarProducto = async (id, { nombre, stock_minimo }) =>
  ok(await supabase.from('productos').update({ nombre, stock_minimo }).eq('id', id).select().single())

// Movimientos
export const registrarMovimiento = async ({ producto_id, tipo, cantidad, fecha, nota }) =>
  ok(await supabase.rpc('registrar_movimiento', {
    p_producto: producto_id, p_tipo: tipo, p_cantidad: cantidad, p_fecha: fecha, p_nota: nota,
  }))
export const editarMovimiento = async (id, { cantidad, fecha, nota }) =>
  ok(await supabase.rpc('editar_movimiento', {
    p_id: id, p_cantidad: cantidad, p_fecha: fecha, p_nota: nota,
  }))
export const listarMovimientos = async (limite = 100) =>
  ok(await supabase.from('movimientos').select('*, productos(nombre)')
    .order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(limite))
export const obtenerMovimiento = async (id) =>
  ok(await supabase.from('movimientos').select('*, productos(nombre, stock_actual)').eq('id', id).single())
export const movimientosEnPeriodo = async (desde, hasta) =>
  ok(await supabase.from('movimientos').select('tipo, cantidad').gte('fecha', desde).lte('fecha', hasta).limit(5000))
