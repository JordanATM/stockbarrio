import './styles.css'
import { configurado } from './supabase.js'
import * as api from './api.js'
import * as v from './views.js'
import { esc } from './ui.js'

const app = document.getElementById('app')

const rutas = [
  [/^#?\/?$/, () => v.resumen()],
  [/^#\/resumen$/, () => v.resumen()],
  [/^#\/productos$/, () => v.productos()],
  [/^#\/productos\/nuevo$/, () => v.productoForm({})],
  [/^#\/productos\/([\w-]+)$/, (m) => v.productoForm({ id: m[1] })],
  [/^#\/movimientos$/, () => v.movimientoNuevo({ tipo: 'venta' })],
  [/^#\/movimientos\/(venta|compra)$/, (m) => v.movimientoNuevo({ tipo: m[1] })],
  [/^#\/historial$/, () => v.historial()],
  [/^#\/historial\/([\w-]+)$/, (m) => v.movimientoVer({ id: m[1] })],
  [/^#\/historial\/([\w-]+)\/editar$/, (m) => v.movimientoEditar({ id: m[1] })],
  [/^#\/alertas$/, () => v.alertas()],
]

const NAV = [
  ['resumen', '#/resumen', 'Resumen', 'Inicio'],
  ['productos', '#/productos', 'Productos', 'Productos'],
  ['movimientos', '#/movimientos/venta', 'Movimientos', 'Movimientos'],
  ['alertas', '#/alertas', 'Alertas e informes', 'Alertas'],
]

let avisoPendiente = null
const ctx = {
  go: (hash) => { location.hash = hash },
  aviso: (texto, tipo = 'ok') => { avisoPendiente = { texto, tipo } },
}

function loginHtml(error = '') {
  app.innerHTML = `
    <main class="login">
      <form class="card" id="login" novalidate>
        <h1>Stock Barrio</h1><p class="muted">Control de existencias · Iniciar sesión</p>
        <label>Correo<input type="email" name="email" autocomplete="username" required /></label>
        <label>Contraseña<input type="password" name="password" autocomplete="current-password" required /></label>
        <p class="error" id="err" ${error ? '' : 'hidden'}>${esc(error)}</p>
        <button class="btn" type="submit">Ingresar</button>
      </form>
    </main>`
  app.querySelector('#login').addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = e.target; const btn = f.querySelector('button'); const err = f.querySelector('#err')
    btn.disabled = true; err.hidden = true
    try { await api.iniciarSesion(f.email.value.trim(), f.password.value); await render() }
    catch (ex) {
      const m = ex.message || ''
      err.textContent = /invalid login/i.test(m) ? 'Correo o contraseña incorrectos.'
        : /not confirmed/i.test(m) ? 'La cuenta aún no está confirmada.'
        : `No se pudo iniciar sesión: ${m}`
      err.hidden = false; btn.disabled = false
    }
  })
}

function layout(vista, aviso) {
  const nav = (movil) => NAV.map(([k, href, largo, corto]) =>
    `<a href="${href}" class="${vista.nav === k ? 'on' : ''}" ${vista.nav === k ? 'aria-current="page"' : ''}>${movil ? corto : largo}</a>`).join('')
  app.innerHTML = `
    <div class="shell">
      <aside class="side"><div><h1>Stock Barrio</h1><p>Control de existencias</p></div>
        <nav>${nav(false)}</nav><button class="salir" id="salir">Cerrar sesión</button></aside>
      <div class="main">
        <header class="top"><div class="mhead"><strong>Stock Barrio</strong><button class="salir" id="salir2">Salir</button></div>
          <div class="titulo"><div><h1>${vista.titulo}</h1><p>${vista.sub || ''}</p></div>
          ${vista.accion ? `<a class="btn" href="${vista.accion.href}">${vista.accion.texto}</a>` : ''}</div></header>
        <main id="contenido">${aviso ? `<p class="aviso ${aviso.tipo}" role="status">${esc(aviso.texto)}</p>` : ''}${vista.html}</main>
      </div>
      <nav class="bottom">${nav(true)}</nav>
    </div>`
  for (const id of ['salir', 'salir2']) app.querySelector('#' + id).addEventListener('click', async () => { await api.cerrarSesion(); await render() })
  vista.bind?.(app.querySelector('#contenido'), ctx)
}

let n = 0
async function render() {
  const mio = ++n
  if (!configurado) { app.innerHTML = '<main class="login"><div class="card"><h1>Falta configuración</h1><p>Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver README).</p></div></main>'; return }
  const sesion = await api.obtenerSesion()
  if (!sesion) return loginHtml()
  const hash = location.hash || '#/resumen'
  const ruta = rutas.find(([re]) => re.test(hash))
  try {
    if (!ruta) { location.hash = '#/resumen'; return }
    const vista = await ruta[1](hash.match(ruta[0]))
    if (mio !== n) return // llegó otra navegación mientras cargaba
    const aviso = avisoPendiente; avisoPendiente = null
    layout(vista, aviso); window.scrollTo(0, 0)
  } catch (err) {
    if (mio !== n) return
    layout({ nav: '', titulo: 'No se pudo cargar', sub: '', html: `<div class="card"><p class="error">${esc(err.message)}</p><a class="btn sec" href="#/resumen">Ir al resumen</a></div>` })
  }
}

addEventListener('hashchange', render)
render()
