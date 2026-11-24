export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export const hoy = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD en hora local
export const primerDiaMes = () => hoy().slice(0, 8) + '01'

export const fmtFecha = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}
export const fmtFechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export const TIPOS = { compra: 'Compra', venta: 'Venta' }
export const efecto = (tipo, cantidad) => (tipo === 'compra' ? cantidad : -cantidad)
export const unidades = (n) => `${n} ${Math.abs(n) === 1 ? 'unidad' : 'unidades'}`
export const conSigno = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${unidades(Math.abs(n))}`

// Cantidad entera positiva o null
export const entero = (v) => {
  const t = String(v ?? '').trim()
  return /^\d+$/.test(t) && Number(t) > 0 ? Number(t) : null
}
