import * as api from './api.js'
import { esc, hoy, primerDiaMes, fmtFecha, fmtFechaHora, TIPOS, efecto, unidades, conSigno, entero } from './ui.js'

// Cada vista devuelve { nav, titulo, sub, accion?, html, bind?(root, ctx) }.
// ctx = { go(hash), aviso(texto, tipo) }

const estado = (p) =>
  api.bajoMinimo(p) ? '<span class="chip warn">Bajo mínimo</span>' : '<span class="chip">Sobre el mínimo</span>'

const mostrarError = (root, msg) => {
  const el = root.querySelector('[data-error]')
  el.textContent = msg || ''
  el.hidden = !msg
}

// ───────── Resumen ─────────
export async function resumen() {
  const [productos, movs] = await Promise.all([api.listarProductos(), api.listarMovimientos(5)])
  const bajos = productos.filter(api.bajoMinimo).length
  return {
    nav: 'resumen', titulo: 'Resumen', sub: 'Existencias visibles para decidir compras',
    accion: { href: '#/movimientos/venta', texto: 'Registrar movimiento' },
    html: `
      <div class="grid2">
        <div class="card stat"><div class="num">${productos.length}</div><div><h3>Productos registrados</h3><p class="muted">Catálogo activo</p></div></div>
        <div class="card stat warn"><div class="num">${bajos}</div><div><h3>Productos bajo mínimo</h3><p class="muted">Revisar reposición</p></div></div>
      </div>
      <div class="card">
        <h2>Movimientos recientes</h2>
        ${movs.length ? `<div class="lista">${movs.map((m) => `
          <a class="fila simple" href="#/historial/${m.id}">
            <span>${TIPOS[m.tipo]} · ${esc(m.productos?.nombre)}</span>
            <strong class="acento">${conSigno(efecto(m.tipo, m.cantidad))}</strong>
          </a>`).join('')}</div>` : '<p class="muted">Aún no hay movimientos.</p>'}
      </div>`,
  }
}

// ───────── Productos ─────────
export async function productos() {
  const lista = await api.listarProductos()
  return {
    nav: 'productos', titulo: 'Productos', sub: 'Búsqueda y control de existencias',
    accion: { href: '#/productos/nuevo', texto: 'Añadir producto' },
    html: `
      <div class="card">
        <div class="barra"><input type="search" id="buscar" placeholder="Buscar producto…" aria-label="Buscar producto" />
          <span class="muted" id="conteo"></span></div>
        <div class="lista tabla" id="lista">
          <div class="fila cab"><span>Nombre</span><span>Mínimo</span><span>Stock actual</span><span>Estado</span><span>Acciones</span></div>
          ${lista.map((p) => `
          <div class="fila ${api.bajoMinimo(p) ? 'alerta' : ''}" data-nombre="${esc(p.nombre.toLowerCase())}">
            <strong>${esc(p.nombre)}</strong>
            <span data-l="Mínimo">${p.stock_minimo}</span>
            <strong data-l="Stock">${p.stock_actual}</strong>
            <span>${estado(p)}</span>
            <span><a class="btn sec peq" href="#/productos/${p.id}">Editar</a></span>
          </div>`).join('')}
        </div>
        <p class="muted vacio" id="vacio" ${lista.length ? 'hidden' : ''}>No hay productos. Usa «Añadir producto».</p>
        <p class="muted">Los mínimos permiten identificar qué productos necesitan una revisión de reposición.</p>
      </div>`,
    bind(root) {
      const filas = [...root.querySelectorAll('#lista .fila[data-nombre]')]
      const conteo = root.querySelector('#conteo')
      const filtrar = (q) => {
        let n = 0
        for (const f of filas) { const v = f.dataset.nombre.includes(q.trim().toLowerCase()); f.hidden = !v; if (v) n++ }
        conteo.textContent = `${n} producto${n === 1 ? '' : 's'}`
      }
      root.querySelector('#buscar').addEventListener('input', (e) => filtrar(e.target.value))
      filtrar('')
    },
  }
}

// ───────── Producto (nuevo / editar) ─────────
export async function productoForm({ id }) {
  const nuevo = !id
  const p = nuevo ? { nombre: '', stock_minimo: 0, stock_actual: 0 } : await api.obtenerProducto(id)
  return {
    nav: 'productos', titulo: nuevo ? 'Añadir producto' : 'Editar producto',
    sub: nuevo ? 'Datos del nuevo producto' : esc(p.nombre),
    html: `
      <div class="grid2 form-grid">
        <form class="card" id="f" novalidate>
          <h2>Datos del producto</h2>
          <label>Nombre del producto<input name="nombre" required maxlength="80" value="${esc(p.nombre)}" /></label>
          <label>Stock mínimo<input name="minimo" inputmode="numeric" required value="${p.stock_minimo}" /></label>
          ${nuevo ? `<label>Existencia inicial<input name="inicial" inputmode="numeric" required value="${p.stock_actual}" /></label>` : ''}
          <p class="error" data-error hidden></p>
          <div class="botones"><button class="btn" type="submit">Guardar cambios</button><a class="btn sec" href="#/productos">Cancelar</a></div>
        </form>
        ${nuevo ? '' : `<aside class="card info"><h2>Existencia actual</h2><div class="num">${p.stock_actual}</div>
          <p class="muted">Solo lectura. Las existencias se corrigen en Movimientos.</p></aside>`}
      </div>`,
    bind(root, ctx) {
      root.querySelector('#f').addEventListener('submit', async (e) => {
        e.preventDefault()
        const f = new FormData(e.target)
        const nombre = String(f.get('nombre')).trim()
        const entero0 = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : null)
        const minimo = entero0(f.get('minimo'))
        const inicial = nuevo ? entero0(f.get('inicial')) : 0
        if (!nombre) return mostrarError(root, 'Ingresa un nombre.')
        if (minimo === null) return mostrarError(root, 'El stock mínimo debe ser un entero igual o mayor que cero.')
        if (inicial === null) return mostrarError(root, 'La existencia inicial debe ser un entero igual o mayor que cero.')
        const btn = e.target.querySelector('button'); btn.disabled = true
        try {
          if (nuevo) await api.crearProducto({ nombre, stock_minimo: minimo, stock_actual: inicial })
          else await api.editarProducto(id, { nombre, stock_minimo: minimo })
          ctx.aviso('Producto guardado.'); ctx.go('#/productos')
        } catch (err) { mostrarError(root, err.message); btn.disabled = false }
      })
    },
  }
}

// ───────── Movimientos: Venta | Compra | Historial ─────────
const tabs = (activa) => `
  <div class="tabs" role="tablist">
    <a role="tab" class="${activa === 'venta' ? 'on' : ''}" href="#/movimientos/venta">Venta</a>
    <a role="tab" class="${activa === 'compra' ? 'on' : ''}" href="#/movimientos/compra">Compra</a>
    <a role="tab" class="${activa === 'historial' ? 'on' : ''}" href="#/historial">Historial</a>
  </div>`

const vistaPrevia = (antes, despues, nota) => `
  <div class="prev"><span>Stock antes</span><strong>${antes}</strong></div>
  <div class="prev dest"><span>Stock proyectado</span><strong class="${despues < 0 ? 'neg' : 'acento'}">${despues}</strong></div>
  ${nota ? `<p class="muted">${nota}</p>` : ''}`

export async function movimientoNuevo({ tipo }) {
  const lista = await api.listarProductos()
  const verbo = tipo === 'venta' ? 'descuenta' : 'suma'
  return {
    nav: 'movimientos', titulo: 'Movimientos', sub: 'Registra compras y ventas de stock',
    html: `
      <div class="grid2 form-grid">
        <form class="card" id="f" novalidate>
          <h2>Registrar movimiento</h2>
          ${tabs(tipo)}
          ${lista.length ? `
          <label>Producto<select name="producto">${lista.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></label>
          <label>Cantidad<input name="cantidad" inputmode="numeric" value="1" required /></label>
          <label>Fecha<input type="date" name="fecha" value="${hoy()}" max="${hoy()}" required /></label>
          <label>Nota (opcional)<input name="nota" maxlength="200" /></label>
          <p class="muted" id="ayuda"></p>
          <p class="error" data-error hidden></p>
          <button class="btn" type="submit">Guardar ${tipo}</button>` : '<p class="muted">Primero crea un producto en <a href="#/productos/nuevo">Productos</a>.</p>'}
        </form>
        <div>
          <aside class="card info"><h2>Vista previa del stock</h2><p id="pnombre" class="muted"></p><div id="prev"></div></aside>
        </div>
      </div>`,
    bind(root, ctx) {
      const f = root.querySelector('#f'); if (!f.producto) return
      const prev = root.querySelector('#prev'); const btn = f.querySelector('button')
      const refrescar = () => {
        const p = lista.find((x) => x.id === f.producto.value)
        const q = entero(f.cantidad.value)
        root.querySelector('#pnombre').textContent = p.nombre
        root.querySelector('#ayuda').textContent = q ? `La ${tipo} ${verbo} ${unidades(q)} del stock actual.` : ''
        if (!q) { prev.innerHTML = vistaPrevia(p.stock_actual, p.stock_actual, 'Ingresa una cantidad entera mayor que cero.'); btn.disabled = true; return }
        const despues = p.stock_actual + efecto(tipo, q)
        prev.innerHTML = vistaPrevia(p.stock_actual, despues, despues < 0 ? 'Stock insuficiente para esta venta.' : 'Proyección de este movimiento.')
        btn.disabled = despues < 0
      }
      f.addEventListener('input', refrescar); refrescar()
      f.addEventListener('submit', async (e) => {
        e.preventDefault()
        const q = entero(f.cantidad.value)
        if (!q) return mostrarError(root, 'La cantidad debe ser un entero mayor que cero.')
        btn.disabled = true
        try {
          await api.registrarMovimiento({ producto_id: f.producto.value, tipo, cantidad: q, fecha: f.fecha.value, nota: f.nota.value })
          ctx.aviso(`${TIPOS[tipo]} registrada.`); ctx.go('#/historial')
        } catch (err) { mostrarError(root, err.message); btn.disabled = false }
      })
    },
  }
}

// ───────── Historial ─────────
export async function historial() {
  const movs = await api.listarMovimientos(100)
  return {
    nav: 'movimientos', titulo: 'Movimientos', sub: 'Historial de compras y ventas',
    html: `
      <div class="card">
        ${tabs('historial')}
        ${movs.length ? `
        <div class="lista tabla hist">
          <div class="fila cab"><span>Movimiento</span><span>Fecha</span><span>Acciones</span></div>
          ${movs.map((m) => `
          <div class="fila">
            <span><strong>${TIPOS[m.tipo]} · ${esc(m.productos?.nombre)}</strong><br>
              <span class="${m.tipo === 'compra' ? 'acento' : 'ambar'}">${conSigno(efecto(m.tipo, m.cantidad))}</span>
              ${m.editado_at ? '<span class="chip">Editado</span>' : ''}</span>
            <span data-l="Fecha">${fmtFecha(m.fecha)}</span>
            <span class="botones"><a class="btn sec peq" href="#/historial/${m.id}">Ver</a>
              <a class="btn peq" href="#/historial/${m.id}/editar">Editar</a></span>
          </div>`).join('')}
        </div>` : '<p class="muted">Aún no hay movimientos registrados.</p>'}
        ${movs.length === 100 ? '<p class="muted">Se muestran los 100 movimientos más recientes.</p>' : ''}
      </div>`,
  }
}

export async function movimientoVer({ id }) {
  const m = await api.obtenerMovimiento(id)
  const dato = (k, v) => `<div class="dato"><span class="muted">${k}</span><strong>${v}</strong></div>`
  return {
    nav: 'movimientos', titulo: 'Detalle del movimiento', sub: `${TIPOS[m.tipo]} · ${esc(m.productos?.nombre)}`,
    html: `
      <div class="card">
        ${dato('Tipo', TIPOS[m.tipo])}
        ${dato('Producto', esc(m.productos?.nombre))}
        ${dato('Cantidad', conSigno(efecto(m.tipo, m.cantidad)))}
        ${dato('Fecha', fmtFecha(m.fecha))}
        ${dato('Nota', esc(m.nota) || '—')}
        ${dato('Registrado', fmtFechaHora(m.created_at))}
        ${dato('Última edición', fmtFechaHora(m.editado_at))}
        <div class="botones"><a class="btn" href="#/historial/${m.id}/editar">Editar</a><a class="btn sec" href="#/historial">Volver al historial</a></div>
      </div>`,
  }
}

export async function movimientoEditar({ id }) {
  const m = await api.obtenerMovimiento(id)
  const stock = m.productos.stock_actual
  return {
    nav: 'movimientos', titulo: 'Editar movimiento', sub: `${TIPOS[m.tipo]} · ${esc(m.productos.nombre)}`,
    html: `
      <div class="grid2 form-grid">
        <form class="card" id="f" novalidate>
          <h2>Corregir movimiento</h2>
          <p class="muted">El tipo y el producto no se pueden cambiar. Si te equivocaste de producto o tipo, edita la cantidad y registra el movimiento correcto.</p>
          <label>Cantidad<input name="cantidad" inputmode="numeric" required value="${m.cantidad}" /></label>
          <label>Fecha<input type="date" name="fecha" value="${m.fecha}" max="${hoy()}" required /></label>
          <label>Nota (opcional)<input name="nota" maxlength="200" value="${esc(m.nota)}" /></label>
          <p class="error" data-error hidden></p>
          <div class="botones"><button class="btn" type="submit">Guardar cambios</button><a class="btn sec" href="#/historial/${m.id}">Cancelar</a></div>
        </form>
        <aside class="card info"><h2>Efecto en el stock</h2><p id="pnombre" class="muted">${esc(m.productos.nombre)}</p><div id="prev"></div></aside>
      </div>`,
    bind(root, ctx) {
      const f = root.querySelector('#f'); const btn = f.querySelector('button'); const prev = root.querySelector('#prev')
      const refrescar = () => {
        const q = entero(f.cantidad.value)
        if (!q) { prev.innerHTML = vistaPrevia(stock, stock, 'Ingresa una cantidad entera mayor que cero.'); btn.disabled = true; return }
        const despues = stock + efecto(m.tipo, q) - efecto(m.tipo, m.cantidad)
        prev.innerHTML = vistaPrevia(stock, despues, despues < 0 ? 'La edición dejaría el stock en negativo.' : 'Stock resultante tras la corrección.')
        btn.disabled = despues < 0
      }
      f.addEventListener('input', refrescar); refrescar()
      f.addEventListener('submit', async (e) => {
        e.preventDefault()
        const q = entero(f.cantidad.value)
        if (!q) return mostrarError(root, 'La cantidad debe ser un entero mayor que cero.')
        btn.disabled = true
        try {
          await api.editarMovimiento(id, { cantidad: q, fecha: f.fecha.value, nota: f.nota.value })
          ctx.aviso('Movimiento actualizado.'); ctx.go(`#/historial/${id}`)
        } catch (err) { mostrarError(root, err.message); btn.disabled = false }
      })
    },
  }
}

// ───────── Alertas e informes ─────────
export async function alertas() {
  const lista = (await api.listarProductos()).filter(api.bajoMinimo)
  return {
    nav: 'alertas', titulo: 'Alertas e informes', sub: 'Información para revisar la reposición',
    html: `
      <div class="grid2">
        <div class="card"><h2>Productos bajo mínimo</h2>
          ${lista.length ? lista.map((p) => `
            <a class="item-alerta" href="#/productos/${p.id}"><strong>${esc(p.nombre)}</strong><span class="chip warn">Bajo mínimo</span>
              <span class="ambar">${p.stock_actual} disponibles · mínimo ${p.stock_minimo}</span></a>`).join('')
            : '<p class="muted">Ningún producto bajo el mínimo.</p>'}
        </div>
        <div class="card"><h2>Informe básico de movimientos</h2>
          <div class="periodo"><label>Desde<input type="date" id="desde" value="${primerDiaMes()}" /></label>
            <label>Hasta<input type="date" id="hasta" value="${hoy()}" /></label></div>
          <div id="informe"></div>
        </div>
      </div>`,
    bind(root) {
      const desde = root.querySelector('#desde'); const hasta = root.querySelector('#hasta'); const out = root.querySelector('#informe')
      const cargar = async () => {
        if (!desde.value || !hasta.value || desde.value > hasta.value) { out.innerHTML = '<p class="error">Revisa el período elegido.</p>'; return }
        out.innerHTML = '<p class="muted">Cargando…</p>'
        try {
          const rows = await api.movimientosEnPeriodo(desde.value, hasta.value)
          const t = (tipo) => { const r = rows.filter((x) => x.tipo === tipo); return { n: r.length, u: r.reduce((a, x) => a + x.cantidad, 0) } }
          const fila = (nom, x) => `<div class="fila simple resumen"><span>${nom}</span><strong class="acento">${x.n}</strong><span class="muted">${unidades(x.u)}</span></div>`
          out.innerHTML = fila('Compras registradas', t('compra')) + fila('Ventas registradas', t('venta'))
        } catch (err) { out.innerHTML = `<p class="error">${esc(err.message)}</p>` }
      }
      desde.addEventListener('change', cargar); hasta.addEventListener('change', cargar); cargar()
    },
  }
}
