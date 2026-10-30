// =====================================================================
// BeautyStock - panel de administracion
// Cada "vista" (Panel, Ventas, Productos...) es una funcion que dibuja
// su contenido dentro de <div id="vista"> usando datos de la API.
// =====================================================================

// ---------- Utilidades ----------

const $ = (selector, raiz = document) => raiz.querySelector(selector);
const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

/** Formato de pesos colombianos sin decimales: $125.000 */
const cop = (n) => '$' + Math.round(n || 0).toLocaleString('es-CO');

/** Evita que un texto escrito por el usuario se interprete como HTML. */
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fecha = (iso) => iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const fechaHora = (iso) => iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
const hoyISO = () => new Date().toLocaleDateString('en-CA');
const METODOS = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', NEQUI: 'Nequi' };
const opcionesMetodo = (sel) => Object.entries(METODOS).map(([v, t]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${t}</option>`).join('');
const telWa = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.length === 10 ? '57' + d : d; };

/** Llama a la API. Lanza un error con el mensaje del servidor si algo falla. */
async function api(url, { metodo = 'GET', datos, formulario } = {}) {
  const opciones = { method: metodo, headers: {} };
  if (formulario) {
    opciones.body = formulario;
  } else if (datos !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(datos);
  }
  const respuesta = await fetch(url, opciones);
  if (respuesta.status === 401) {
    location.href = '/login.html?expiro';
    throw new Error('Sesión expirada');
  }
  if (respuesta.status === 204) return null;
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(cuerpo.mensaje || 'Ocurrió un error (' + respuesta.status + ')');
    error.estado = respuesta.status;
    error.advertencias = cuerpo.advertencias;
    throw error;
  }
  return cuerpo;
}

function avisar(texto, tipo = '') {
  const caja = document.createElement('div');
  caja.className = 'aviso ' + tipo;
  caja.textContent = texto;
  $('#avisos').append(caja);
  setTimeout(() => caja.remove(), tipo === 'error' ? 6000 : 3500);
}

/** Ejecuta una accion y muestra el error si falla. */
async function intentar(accion) {
  try {
    return await accion();
  } catch (e) {
    avisar(e.message, 'error');
  }
}

/** Abre una ventana modal. Devuelve el elemento para buscar dentro de el. */
function abrirModal(titulo, html, { grande = false } = {}) {
  cerrarModal();
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.id = 'modal';
  fondo.innerHTML = `<div class="modal ${grande ? 'grande' : ''}" role="dialog" aria-modal="true">
      <div class="modal-cabecera"><h2>${titulo}</h2><button type="button" class="icono" data-cerrar aria-label="Cerrar">✕</button></div>
      ${html}</div>`;
  fondo.addEventListener('click', (e) => {
    if (e.target === fondo || e.target.closest('[data-cerrar]')) cerrarModal();
  });
  document.body.append(fondo);
  const primero = $('input:not([type=hidden]), select, textarea', fondo);
  if (primero) primero.focus();
  return fondo;
}
function cerrarModal() { $('#modal')?.remove(); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });

/** Lee los campos de un formulario como objeto. Los campos con data-numero se convierten en numero. */
function leerFormulario(form) {
  const datos = {};
  for (const campo of form.elements) {
    if (!campo.name) continue;
    if (campo.type === 'checkbox') datos[campo.name] = campo.checked;
    else if (campo.dataset.numero !== undefined) datos[campo.name] = campo.value === '' ? null : Number(campo.value);
    else datos[campo.name] = campo.value.trim() === '' ? null : campo.value.trim();
  }
  return datos;
}

const vista = () => $('#vista');

// ---------- Navegacion ----------

const vistas = { panel, ventas, pedidos, productos, compras, inventario, clientes, configuracion };

async function navegar() {
  const nombre = location.hash.slice(1) || 'panel';
  const dibujar = vistas[nombre] || panel;
  $$('#menu a').forEach((a) => a.classList.toggle('activo', a.dataset.vista === nombre));
  $('#app').classList.remove('menu-abierto');
  cerrarModal();
  vista().innerHTML = '<p class="suave">Cargando…</p>';
  await intentar(dibujar);
  actualizarContadorPedidos();
}
window.addEventListener('hashchange', navegar);
$('#abrir-menu').addEventListener('click', () => $('#app').classList.toggle('menu-abierto'));

async function actualizarContadorPedidos() {
  const lista = await api('/api/pedidos').catch(() => []);
  const n = lista.filter((p) => p.estado === 'PENDIENTE').length;
  const contador = $('#contador-pedidos');
  contador.hidden = n === 0;
  contador.textContent = n;
}

// ---------- Sesion activa mientras se usa la app ----------
// El servidor cierra la sesion tras 30 minutos sin peticiones. Si estas usando la pantalla
// (mouse, teclado, toques) pero sin consultar nada, se le avisa cada 4 minutos que sigues aqui.
// Si de verdad no hay actividad en 30 minutos, se vuelve al inicio de sesion.

const MINUTO = 60 * 1000;
let ultimaActividad = Date.now();
let ultimoLatido = Date.now();

['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach((evento) =>
  window.addEventListener(evento, () => { ultimaActividad = Date.now(); }, { passive: true }));

async function latido() {
  const inactivo = Date.now() - ultimaActividad;
  if (inactivo >= 30 * MINUTO) {
    location.href = '/login.html?expiro';
    return;
  }
  // Solo avisa si hubo actividad desde el ultimo aviso.
  if (ultimaActividad > ultimoLatido) {
    ultimoLatido = Date.now();
    await api('/api/sesion').catch(() => { /* api() ya envia al login si la sesion expiro */ });
  }
}
setInterval(latido, 4 * MINUTO);
// Al volver a la pestana (por ejemplo, desde el celular) se revisa enseguida.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - ultimaActividad >= 30 * MINUTO) {
    location.href = '/login.html?expiro';
  } else {
    ultimaActividad = Date.now();
    ultimoLatido = Date.now();
    api('/api/sesion').catch(() => {});
  }
});

// Tema claro / oscuro (se recuerda en este navegador).
function aplicarTema(tema) {
  if (tema) document.documentElement.dataset.theme = tema;
}
try { aplicarTema(localStorage.getItem('tema')); } catch { /* sin almacenamiento */ }
$('#tema').addEventListener('click', () => {
  const oscuro = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const nuevo = oscuro ? 'light' : 'dark';
  aplicarTema(nuevo);
  try { localStorage.setItem('tema', nuevo); } catch { /* sin almacenamiento */ }
});

// =====================================================================
// PANEL PRINCIPAL
// =====================================================================

async function panel() {
  const d = await api('/api/panel');
  vista().innerHTML = `
    <div class="cabecera"><h1>Panel</h1><a class="boton primario" href="#ventas" data-nueva-venta>+ Nueva venta</a></div>
    <div class="indicadores">
      <div class="tarjeta indicador destacado"><div class="titulo">Ventas de hoy</div><div class="valor">${cop(d.ventasHoy)}</div><div class="detalle">${d.numeroVentasHoy} venta(s)</div></div>
      <div class="tarjeta indicador"><div class="titulo">Utilidad estimada hoy</div><div class="valor">${cop(d.utilidadHoy)}</div><div class="detalle">Según costo real (PEPS)</div></div>
      <div class="tarjeta indicador"><div class="titulo">Cuentas por cobrar</div><div class="valor">${cop(d.cuentasPorCobrar)}</div><div class="detalle">Por pagar: ${cop(d.cuentasPorPagar)}</div></div>
      <div class="tarjeta indicador"><div class="titulo">Inventario actual</div><div class="valor">${d.unidadesInventario.toLocaleString('es-CO')} und</div><div class="detalle">Valor al costo: ${cop(d.valorInventario)}</div></div>
    </div>
    <div class="indicadores">
      <div class="tarjeta indicador"><div class="titulo">Ventas del mes</div><div class="valor">${cop(d.ventasMes)}</div></div>
      <div class="tarjeta indicador"><div class="titulo">Utilidad del mes</div><div class="valor">${cop(d.utilidadMes)}</div></div>
      <div class="tarjeta indicador"><div class="titulo">Pedidos por confirmar</div><div class="valor">${d.pedidosPendientes}</div><div class="detalle"><a href="#pedidos">Ver pedidos</a></div></div>
    </div>
    <section class="tarjeta">
      <h2>Alertas</h2>
      <div class="alertas">
        ${d.alertas.length ? d.alertas.map((a) => `<a class="alerta ${a.tipo}" href="#${a.vista}">${esc(a.mensaje)}</a>`).join('') : '<p class="suave">Todo en orden. No hay alertas.</p>'}
      </div>
    </section>`;
  $('[data-nueva-venta]').addEventListener('click', () => { sessionStorage.setItem('abrirVenta', '1'); });
}

// =====================================================================
// PRODUCTOS
// =====================================================================

let categoriasCache = [];

async function productos() {
  categoriasCache = await api('/api/categorias');
  vista().innerHTML = `
    <div class="cabecera"><h1>Productos</h1>
      <button type="button" id="btn-categorias">Categorías</button>
      <button type="button" class="primario" id="btn-nuevo">+ Nuevo producto</button></div>
    <div class="barra">
      <input type="search" id="buscar" placeholder="Buscar por nombre, código, marca o categoría">
      <select id="filtro-categoria"><option value="">Todas las categorías</option>${categoriasCache.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select>
      <select id="filtro-estado">
        <option value="activos">Activos</option><option value="agotados">Agotados</option>
        <option value="bajo">Stock bajo</option><option value="inactivos">Desactivados</option><option value="todos">Todos</option>
      </select>
    </div>
    <div id="lista"></div>`;
  const cargar = () => intentar(async () => {
    const params = new URLSearchParams({ q: $('#buscar').value });
    if ($('#filtro-categoria').value) params.set('categoriaId', $('#filtro-categoria').value);
    const estado = $('#filtro-estado').value;
    let lista = await api('/api/productos?' + params);
    lista = lista.filter((p) => ({
      activos: p.activo, agotados: p.activo && p.existencias === 0, bajo: p.activo && p.stockBajo,
      inactivos: !p.activo, todos: true,
    }[estado]));
    dibujarProductos(lista, cargar);
  });
  let espera;
  $('#buscar').addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(cargar, 250); });
  $('#filtro-categoria').addEventListener('change', cargar);
  $('#filtro-estado').addEventListener('change', cargar);
  $('#btn-nuevo').addEventListener('click', () => formularioProducto(null, cargar));
  $('#btn-categorias').addEventListener('click', () => gestionarCategorias(productos));
  await cargar();
}

function etiquetaStock(p) {
  if (!p.activo) return '<span class="etiqueta neutra">Desactivado</span>';
  if (p.existencias === 0) return '<span class="etiqueta agotado">Agotado</span>';
  if (p.stockBajo) return `<span class="etiqueta bajo">${p.existencias} · bajo</span>`;
  return `<span class="etiqueta ok">${p.existencias}</span>`;
}

function dibujarProductos(lista, recargar) {
  if (!lista.length) {
    $('#lista').innerHTML = '<div class="tarjeta vacio">No hay productos con ese filtro. Crea uno con «+ Nuevo producto».</div>';
    return;
  }
  $('#lista').innerHTML = `<div class="tabla-contenedor"><table>
    <thead><tr><th></th><th>Código</th><th>Producto</th><th>Categoría</th><th class="num">Costo</th><th class="num">Precio</th><th>Existencias</th><th></th></tr></thead>
    <tbody>${lista.map((p) => `<tr class="${p.activo ? '' : 'inactivo'}">
      <td><button type="button" class="foto-boton" data-imagenes="${p.id}" title="Ver o agregar fotos" aria-label="Fotos de ${esc(p.nombre)}">
        ${p.imagenes.length ? `<img class="miniatura" src="/api/public/imagenes/${p.imagenes[0]}" alt="">` : '<span class="miniatura sin-foto">📷+</span>'}</button></td>
      <td>${esc(p.codigo)}</td>
      <td><strong>${esc(p.nombre)}</strong><br><span class="suave">${esc(p.marca)}</span></td>
      <td>${esc(p.categoriaNombre || '—')}</td>
      <td class="num">${cop(p.costo)}</td>
      <td class="num">${cop(p.precioVenta)}${p.precioVenta !== p.precioSugerido ? `<br><span class="suave" title="Precio sugerido">sug. ${cop(p.precioSugerido)}</span>` : ''}</td>
      <td>${etiquetaStock(p)}${p.reservado ? ` <span class="etiqueta neutra" title="Reservado por pedidos">${p.reservado} res.</span>` : ''}</td>
      <td class="fila fin">
        <button class="pequeno" data-editar="${p.id}">Editar</button>
        <button class="pequeno" data-imagenes="${p.id}">📷 Fotos</button>
        <button class="pequeno" data-historial="${p.id}">Precios</button>
        <button class="pequeno ${p.activo ? 'peligro' : ''}" data-activo="${p.id}" data-valor="${!p.activo}">${p.activo ? 'Desactivar' : 'Activar'}</button>
      </td></tr>`).join('')}</tbody></table></div>`;
  const porId = (id) => lista.find((p) => p.id === Number(id));
  $$('[data-editar]').forEach((b) => b.addEventListener('click', () => formularioProducto(porId(b.dataset.editar), recargar)));
  $$('[data-imagenes]').forEach((b) => b.addEventListener('click', () => gestionarImagenes(b.dataset.imagenes, recargar)));
  $$('[data-historial]').forEach((b) => b.addEventListener('click', () => historialPrecios(porId(b.dataset.historial))));
  $$('[data-activo]').forEach((b) => b.addEventListener('click', () => intentar(async () => {
    await api(`/api/productos/${b.dataset.activo}/activo`, { metodo: 'PUT', datos: { activo: b.dataset.valor === 'true' } });
    avisar(b.dataset.valor === 'true' ? 'Producto activado' : 'Producto desactivado (su historial se conserva)');
    recargar();
  })));
}

function formularioProducto(p, recargar) {
  const m = abrirModal(p ? 'Editar ' + esc(p.codigo) : 'Nuevo producto', `
    <form id="form-producto" class="campos">
      <label class="ancho">Nombre * <input name="nombre" required value="${esc(p?.nombre)}"></label>
      <label>Marca * <input name="marca" required value="${esc(p?.marca)}"></label>
      <label>Categoría <select name="categoriaId" data-numero><option value="">Sin categoría</option>
        ${categoriasCache.map((c) => `<option value="${c.id}" ${c.id === p?.categoriaId ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
      <label>Costo (COP) * <input name="costo" type="number" min="0" step="1" required data-numero value="${p?.costo ?? ''}"></label>
      <label>Precio de venta (COP) <input name="precioVenta" type="number" min="0" step="1" data-numero value="${p?.precioVenta ?? ''}" placeholder="Vacío = sugerido"></label>
      <div class="ancho fila"><span class="suave" id="sugerido"></span><button type="button" class="pequeno" id="usar-sugerido">Usar precio sugerido</button></div>
      <label>Stock mínimo <input name="stockMinimo" type="number" min="0" step="1" data-numero value="${p?.stockMinimo ?? 0}"></label>
      <label class="ancho">Descripción <textarea name="descripcion">${esc(p?.descripcion)}</textarea></label>
      <label class="ancho">📷 Fotos ${p?.imagenes.length ? `(ya tiene ${p.imagenes.length}; las nuevas se agregan)` : '(desde el celular puedes tomarla con la cámara)'}
        <input type="file" id="fotos-producto" accept="image/*" multiple></label>
      ${p ? '' : '<p class="ancho suave">Las existencias se cargan registrando una <strong>Compra</strong> (o un ajuste de inventario).</p>'}
    </form>
    <div class="modal-pie"><button data-cerrar>Cancelar</button><button class="primario" form="form-producto">Guardar</button></div>`);
  const form = $('#form-producto', m);
  let sugerido = 0;
  const calcular = async () => {
    const costo = Number(form.costo.value || 0);
    sugerido = (await api('/api/productos/precio-sugerido?costo=' + costo)).precio;
    $('#sugerido', m).textContent = 'Precio sugerido: ' + cop(sugerido);
  };
  form.costo.addEventListener('input', calcular);
  $('#usar-sugerido', m).addEventListener('click', () => { form.precioVenta.value = sugerido; });
  calcular();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    intentar(async () => {
      const datos = leerFormulario(form);
      datos.precioVenta = datos.precioVenta ?? 0;
      if (p && !datos.precioVenta) datos.precioVenta = sugerido;
      const guardado = await api(p ? '/api/productos/' + p.id : '/api/productos', { metodo: p ? 'PUT' : 'POST', datos });
      const fotos = $('#fotos-producto', m).files;
      if (fotos.length) {
        const envio = new FormData();
        for (const foto of fotos) envio.append('archivos', foto);
        await api(`/api/productos/${guardado.id}/imagenes`, { metodo: 'POST', formulario: envio });
      }
      cerrarModal();
      avisar(fotos.length ? `Producto guardado con ${fotos.length} foto(s)` : 'Producto guardado');
      recargar();
    });
  });
}

function gestionarCategorias(alTerminar) {
  const dibujar = () => {
    const m = abrirModal('Categorías', `
      <form id="form-cat" class="fila"><input name="nombre" placeholder="Nueva categoría" required style="flex:1"><button class="primario">Agregar</button></form>
      <div class="tabla-contenedor" style="margin-top:1em"><table><tbody>
        ${categoriasCache.map((c) => `<tr><td>${esc(c.nombre)}</td><td class="num"><button class="pequeno" data-renombrar="${c.id}">Renombrar</button></td></tr>`).join('') || '<tr><td class="vacio">Sin categorías</td></tr>'}
      </tbody></table></div>
      <div class="modal-pie"><button data-cerrar>Listo</button></div>`);
    m.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) alTerminar(); });
    $('#form-cat', m).addEventListener('submit', (e) => {
      e.preventDefault();
      intentar(async () => {
        await api('/api/categorias', { metodo: 'POST', datos: { nombre: e.target.nombre.value } });
        categoriasCache = await api('/api/categorias');
        dibujar();
      });
    });
    $$('[data-renombrar]', m).forEach((b) => b.addEventListener('click', () => {
      const actual = categoriasCache.find((c) => c.id === Number(b.dataset.renombrar));
      const nombre = prompt('Nuevo nombre', actual.nombre);
      if (!nombre) return;
      intentar(async () => {
        await api('/api/categorias/' + actual.id, { metodo: 'PUT', datos: { nombre } });
        categoriasCache = await api('/api/categorias');
        dibujar();
      });
    }));
  };
  dibujar();
}

async function gestionarImagenes(id, recargar) {
  const p = await api('/api/productos/' + id);
  const m = abrirModal('Fotos · ' + esc(p.nombre), `
    <p class="suave">La primera foto (★) es la principal y se muestra en el catálogo. Desde el celular puedes tomar la foto directamente.</p>
    <div class="galeria">${p.imagenes.map((img, i) => `<figure><img src="/api/public/imagenes/${img}" alt="">
      <figcaption>${i === 0 ? '<span class="etiqueta">★ Principal</span>' : `<button class="pequeno" data-principal="${img}">★</button>`}
      <button class="pequeno peligro" data-borrar="${img}" aria-label="Eliminar">🗑</button></figcaption></figure>`).join('')}</div>
    <form id="form-img" class="fila" style="margin-top:1em"><input type="file" name="archivos" accept="image/*" multiple required style="flex:1"><button class="primario">Subir</button></form>
    <div class="modal-pie"><button data-cerrar>Listo</button></div>`);
  m.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) recargar(); });
  $('#form-img', m).addEventListener('submit', (e) => {
    e.preventDefault();
    intentar(async () => {
      await api(`/api/productos/${id}/imagenes`, { metodo: 'POST', formulario: new FormData(e.target) });
      avisar('Fotos agregadas');
      gestionarImagenes(id, recargar);
    });
  });
  $$('[data-principal]', m).forEach((b) => b.addEventListener('click', () => intentar(async () => {
    await api(`/api/imagenes/${b.dataset.principal}/principal`, { metodo: 'PUT' });
    gestionarImagenes(id, recargar);
  })));
  $$('[data-borrar]', m).forEach((b) => b.addEventListener('click', () => {
    if (!confirm('¿Eliminar esta foto?')) return;
    intentar(async () => {
      await api(`/api/imagenes/${b.dataset.borrar}`, { metodo: 'DELETE' });
      gestionarImagenes(id, recargar);
    });
  }));
}

async function historialPrecios(p) {
  const lista = await api(`/api/productos/${p.id}/historial-precios`);
  abrirModal('Historial de precios · ' + esc(p.nombre), `
    <div class="tabla-contenedor"><table><thead><tr><th>Fecha</th><th class="num">Anterior</th><th class="num">Nuevo</th></tr></thead><tbody>
    ${lista.map((h) => `<tr><td>${fechaHora(h.fecha)}</td><td class="num">${cop(h.precioAnterior)}</td><td class="num">${cop(h.precioNuevo)}</td></tr>`).join('') || '<tr><td colspan="3" class="vacio">Sin cambios de precio</td></tr>'}
    </tbody></table></div><div class="modal-pie"><button data-cerrar>Cerrar</button></div>`);
}

// =====================================================================
// COMPRAS (entrada de mercancia)
// =====================================================================

async function compras() {
  vista().innerHTML = `
    <div class="cabecera"><h1>Compras</h1><button class="primario" id="btn-compra">+ Registrar compra</button></div>
    <div class="barra"><label class="check"><input type="checkbox" id="solo-pendientes"> Solo con saldo pendiente (cuentas por pagar)</label></div>
    <div id="lista"></div>`;
  const cargar = () => intentar(async () => {
    const lista = await api('/api/compras?pendientes=' + $('#solo-pendientes').checked);
    $('#lista').innerHTML = lista.length ? `<div class="tabla-contenedor"><table>
      <thead><tr><th>Número</th><th>Fecha</th><th>Proveedor</th><th class="num">Total</th><th class="num">Pagado</th><th class="num">Saldo</th><th>Vence</th><th></th></tr></thead>
      <tbody>${lista.map((c) => `<tr>
        <td><strong>${c.numero}</strong></td><td>${fecha(c.fecha + 'T00:00')}</td><td>${esc(c.proveedor || '—')}</td>
        <td class="num">${cop(c.total)}</td><td class="num">${cop(c.pagado)}</td>
        <td class="num">${c.saldo ? `<span class="etiqueta aviso">${cop(c.saldo)}</span>` : '<span class="etiqueta ok">Pagada</span>'}</td>
        <td>${c.fechaVencimiento ? etiquetaVencimiento(c.fechaVencimiento, c.saldo) : '—'}</td>
        <td class="num"><button class="pequeno" data-ver="${c.id}">Ver</button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="tarjeta vacio">No hay compras registradas.</div>';
    $$('[data-ver]').forEach((b) => b.addEventListener('click', () => verCompra(b.dataset.ver, cargar)));
  });
  $('#solo-pendientes').addEventListener('change', cargar);
  $('#btn-compra').addEventListener('click', () => nuevaCompra(cargar));
  await cargar();
}

function etiquetaVencimiento(fechaIso, saldo) {
  const hoy = hoyISO();
  const tres = new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-CA');
  const texto = fecha(fechaIso + 'T00:00');
  if (!saldo) return texto;
  if (fechaIso < hoy) return `<span class="etiqueta peligro">Vencida ${texto}</span>`;
  if (fechaIso <= tres) return `<span class="etiqueta aviso">${texto}</span>`;
  return texto;
}

async function nuevaCompra(recargar) {
  const lista = (await api('/api/productos?soloActivos=true'));
  if (!lista.length) {
    avisar('Primero crea productos en la sección Productos.', 'error');
    return;
  }
  const opciones = lista.map((p) => `<option value="${p.id}" data-costo="${p.costo}">${esc(p.codigo)} · ${esc(p.nombre)} (${esc(p.marca)})</option>`).join('');
  const m = abrirModal('Registrar compra', `
    <form id="form-compra">
      <div class="campos">
        <label>Fecha <input type="date" name="fecha" value="${hoyISO()}"></label>
        <label>Proveedor (opcional) <input name="proveedor" placeholder="Texto libre"></label>
      </div>
      <h3 style="margin-top:1.2em">Productos</h3>
      <div id="lineas"></div>
      <button type="button" class="pequeno" id="agregar-linea">+ Agregar producto</button>
      <div class="campos" style="margin-top:1.2em">
        <label>Costos adicionales (transporte…) <input type="number" min="0" name="costosAdicionales" value="0" data-numero></label>
        <label>Nota de costos adicionales <input name="notaCostosAdicionales"></label>
      </div>
      <p class="suave">Los costos adicionales se guardan aparte y no se reparten entre los productos.</p>
      <div class="totales"><span>Total productos</span><span class="grande" id="total-compra">$0</span></div>
      <h3 style="margin-top:1em">Pago al proveedor</h3>
      <div class="campos">
        <label>Valor pagado ahora <input type="number" min="0" name="montoPagado" value="0" data-numero></label>
        <label>Método <select name="metodoPago">${opcionesMetodo('EFECTIVO')}</select></label>
        <label>Vence (si queda saldo) <input type="date" name="fechaVencimiento"></label>
      </div>
      <div class="fila" style="margin-top:.6em"><button type="button" class="pequeno" id="pago-total">Pagó todo</button>
        <label class="check"><input type="checkbox" name="actualizarPrecios"> Actualizar el precio de venta al sugerido con el nuevo costo</label></div>
    </form>
    <div class="modal-pie"><button data-cerrar>Cancelar</button><button class="primario" form="form-compra">Guardar compra</button></div>`, { grande: true });

  const lineas = $('#lineas', m);
  const total = () => $$('.linea', lineas).reduce((s, l) => s + Number(l.querySelector('[name=cantidad]').value || 0) * Number(l.querySelector('[name=costo]').value || 0), 0);
  const refrescar = () => { $('#total-compra', m).textContent = cop(total()); };
  const agregar = () => {
    const linea = document.createElement('div');
    linea.className = 'linea campos';
    linea.style.cssText = 'grid-template-columns: 2fr 90px 140px auto; align-items:end; margin-bottom:.5em';
    linea.innerHTML = `<label>Producto <select name="producto">${opciones}</select></label>
      <label>Cantidad <input type="number" name="cantidad" min="1" value="1"></label>
      <label>Costo unitario <input type="number" name="costo" min="0"></label>
      <button type="button" class="icono peligro" aria-label="Quitar">✕</button>`;
    const sel = linea.querySelector('select');
    const costo = linea.querySelector('[name=costo]');
    const ponerCosto = () => { costo.value = sel.selectedOptions[0].dataset.costo; refrescar(); };
    sel.addEventListener('change', ponerCosto);
    linea.querySelector('button').addEventListener('click', () => { linea.remove(); refrescar(); });
    linea.addEventListener('input', refrescar);
    lineas.append(linea);
    ponerCosto();
  };
  $('#agregar-linea', m).addEventListener('click', agregar);
  $('#pago-total', m).addEventListener('click', () => { $('[name=montoPagado]', m).value = total(); });
  agregar();

  $('#form-compra', m).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const items = $$('.linea', lineas).map((l) => ({
      productoId: Number(l.querySelector('select').value),
      cantidad: Number(l.querySelector('[name=cantidad]').value),
      costoUnitario: Number(l.querySelector('[name=costo]').value),
    }));
    if (!items.length) return avisar('Agrega al menos un producto', 'error');
    intentar(async () => {
      const c = await api('/api/compras', { metodo: 'POST', datos: {
        fecha: f.fecha.value || null, proveedor: f.proveedor.value, items,
        costosAdicionales: Number(f.costosAdicionales.value || 0), notaCostosAdicionales: f.notaCostosAdicionales.value,
        montoPagado: Number(f.montoPagado.value || 0), metodoPago: f.metodoPago.value,
        fechaVencimiento: f.fechaVencimiento.value || null, actualizarPrecios: f.actualizarPrecios.checked,
      } });
      cerrarModal();
      avisar(`Compra ${c.numero} registrada. Inventario actualizado.`);
      recargar();
    });
  });
}

async function verCompra(id, recargar) {
  const c = await api('/api/compras/' + id);
  const m = abrirModal('Compra ' + c.numero, `
    <p>${fecha(c.fecha + 'T00:00')} · ${esc(c.proveedor || 'Sin proveedor')}</p>
    <div class="tabla-contenedor"><table><thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Costo</th><th class="num">Subtotal</th></tr></thead><tbody>
      ${c.items.map((i) => `<tr><td>${esc(i.productoNombre)}</td><td class="num">${i.cantidad}</td><td class="num">${cop(i.costoUnitario)}</td><td class="num">${cop(i.subtotal)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="totales" style="margin-top:1em">
      <span>Total</span><strong>${cop(c.total)}</strong>
      ${c.costosAdicionales ? `<span>Costos adicionales${c.notaCostosAdicionales ? ' (' + esc(c.notaCostosAdicionales) + ')' : ''}</span><span>${cop(c.costosAdicionales)}</span>` : ''}
      <span>Pagado</span><span>${cop(c.pagado)}</span><span>Saldo</span><strong>${cop(c.saldo)}</strong>
    </div>
    <h3>Pagos (comprobantes PP)</h3>
    ${tablaPagos(c.pagos)}
    ${c.saldo ? formularioAbono() : ''}
    <div class="modal-pie"><button data-cerrar>Cerrar</button></div>`);
  $('#form-abono', m)?.addEventListener('submit', (e) => {
    e.preventDefault();
    intentar(async () => {
      await api(`/api/compras/${id}/pagos`, { metodo: 'POST', datos: leerFormulario(e.target) });
      avisar('Pago registrado');
      recargar();
      verCompra(id, recargar);
    });
  });
}

function tablaPagos(pagos) {
  return `<div class="tabla-contenedor"><table><thead><tr><th>Comprobante</th><th>Fecha</th><th>Método</th><th>Documento</th><th class="num">Valor</th></tr></thead><tbody>
    ${pagos.map((p) => `<tr><td>${p.numero}</td><td>${fechaHora(p.fecha)}</td><td>${METODOS[p.metodo]}</td><td>${p.documento}</td><td class="num">${cop(p.valor)}</td></tr>`).join('') || '<tr><td colspan="5" class="vacio">Sin pagos</td></tr>'}
  </tbody></table></div>`;
}

function formularioAbono() {
  return `<form id="form-abono" class="fila" style="margin-top:1em">
    <input type="number" name="valor" min="1" required placeholder="Valor del abono" data-numero style="flex:1;min-width:140px">
    <select name="metodo" style="width:auto">${opcionesMetodo('EFECTIVO')}</select>
    <button class="primario">Registrar abono</button></form>`;
}

// =====================================================================
// INVENTARIO
// =====================================================================

async function inventario() {
  vista().innerHTML = `
    <div class="cabecera"><h1>Inventario</h1></div>
    <div class="pestanas"><button class="activo" data-pestana="existencias">Existencias y lotes</button><button data-pestana="movimientos">Movimientos</button></div>
    <div id="contenido-inventario"></div>`;
  const mostrar = (cual) => {
    $$('[data-pestana]').forEach((b) => b.classList.toggle('activo', b.dataset.pestana === cual));
    intentar(cual === 'existencias' ? existencias : movimientos);
  };
  $$('[data-pestana]').forEach((b) => b.addEventListener('click', () => mostrar(b.dataset.pestana)));
  await existencias();
}

async function existencias() {
  const lista = await api('/api/productos?soloActivos=true');
  const total = lista.reduce((s, p) => s + p.existencias, 0);
  $('#contenido-inventario').innerHTML = `
    <div class="barra"><input type="search" id="buscar-inv" placeholder="Buscar producto"><span class="suave">${total.toLocaleString('es-CO')} unidades en total</span></div>
    <div class="tabla-contenedor"><table>
    <thead><tr><th>Producto</th><th class="num">Existencias</th><th class="num">Reservadas</th><th class="num">Disponibles</th><th class="num">Mínimo</th><th class="num">Costo vigente</th><th></th></tr></thead>
    <tbody>${lista.map((p) => `<tr data-texto="${esc((p.nombre + ' ' + p.codigo + ' ' + p.marca).toLowerCase())}">
      <td><strong>${esc(p.nombre)}</strong> <span class="suave">${esc(p.codigo)}</span></td>
      <td class="num">${etiquetaStock(p)}</td><td class="num">${p.reservado || ''}</td><td class="num">${p.disponible}</td>
      <td class="num">${p.stockMinimo}</td><td class="num">${cop(p.costo)}</td>
      <td class="num"><button class="pequeno" data-lotes="${p.id}">Lotes</button> <button class="pequeno" data-ajuste="${p.id}">Ajustar</button></td></tr>`).join('')}</tbody></table></div>`;
  $('#buscar-inv').addEventListener('input', (e) => {
    const t = e.target.value.toLowerCase();
    $$('tr[data-texto]').forEach((tr) => { tr.hidden = !tr.dataset.texto.includes(t); });
  });
  const porId = (id) => lista.find((p) => p.id === Number(id));
  $$('[data-lotes]').forEach((b) => b.addEventListener('click', () => intentar(() => verLotes(porId(b.dataset.lotes)))));
  $$('[data-ajuste]').forEach((b) => b.addEventListener('click', () => ajustarInventario(porId(b.dataset.ajuste))));
}

async function verLotes(p) {
  const lotes = await api(`/api/inventario/${p.id}/lotes`);
  const disponibles = lotes.filter((l) => l.cantidadDisponible > 0);
  const valor = disponibles.reduce((s, l) => s + l.cantidadDisponible * l.costoUnitario, 0);
  abrirModal('Lotes · ' + esc(p.nombre), `
    <p class="suave">Las ventas descuentan primero del lote más antiguo (PEPS). Total disponible: <strong>${p.existencias}</strong> · Valor al costo: <strong>${cop(valor)}</strong></p>
    <div class="tabla-contenedor"><table><thead><tr><th>Fecha</th><th>Origen</th><th class="num">Entró</th><th class="num">Quedan</th><th class="num">Costo unit.</th></tr></thead><tbody>
      ${lotes.map((l) => `<tr class="${l.cantidadDisponible ? '' : 'inactivo'}"><td>${fecha(l.fecha)}</td><td>${esc(l.origen)}</td><td class="num">${l.cantidadInicial}</td><td class="num">${l.cantidadDisponible}</td><td class="num">${cop(l.costoUnitario)}</td></tr>`).join('') || '<tr><td colspan="5" class="vacio">Sin lotes. Registra una compra.</td></tr>'}
    </tbody></table></div><div class="modal-pie"><button data-cerrar>Cerrar</button></div>`);
}

function ajustarInventario(p) {
  const m = abrirModal('Ajuste de inventario · ' + esc(p.nombre), `
    <form id="form-ajuste" class="campos">
      <label>Tipo <select name="tipo"><option value="1">Entrada (sumar)</option><option value="-1">Salida (restar)</option></select></label>
      <label>Cantidad <input type="number" name="cantidad" min="1" required></label>
      <label class="ancho">Motivo (opcional) <input name="motivo" placeholder="Conteo físico, regalo, etc."></label>
      <p class="ancho suave">Existencias actuales: ${p.existencias}. Las entradas usan el costo vigente (${cop(p.costo)}); las salidas descuentan por PEPS.</p>
    </form>
    <div class="modal-pie"><button data-cerrar>Cancelar</button><button class="primario" form="form-ajuste">Guardar ajuste</button></div>`);
  $('#form-ajuste', m).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    intentar(async () => {
      await api('/api/inventario/ajustes', { metodo: 'POST', datos: { productoId: p.id, cantidad: Number(f.cantidad.value) * Number(f.tipo.value), motivo: f.motivo.value } });
      cerrarModal();
      avisar('Ajuste registrado');
      existencias();
    });
  });
}

const TIPOS_MOV = { COMPRA: 'Compra', VENTA: 'Venta', AJUSTE_ENTRADA: 'Ajuste +', AJUSTE_SALIDA: 'Ajuste −', ANULACION_VENTA: 'Anulación' };

async function movimientos() {
  const lista = await api('/api/inventario/movimientos');
  $('#contenido-inventario').innerHTML = `<p class="suave">Últimos 200 movimientos.</p><div class="tabla-contenedor"><table>
    <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th class="num">Cantidad</th><th>Documento</th><th>Motivo</th></tr></thead>
    <tbody>${lista.map((m) => `<tr><td>${fechaHora(m.fecha)}</td><td>${esc(m.productoNombre)}</td><td>${TIPOS_MOV[m.tipo]}</td>
      <td class="num"><span class="etiqueta ${m.cantidad > 0 ? 'ok' : 'neutra'}">${m.cantidad > 0 ? '+' : ''}${m.cantidad}</span></td>
      <td>${esc(m.referencia || '')}</td><td>${esc(m.motivo || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="vacio">Sin movimientos</td></tr>'}</tbody></table></div>`;
}

// =====================================================================
// VENTAS
// =====================================================================

async function ventas() {
  vista().innerHTML = `
    <div class="cabecera"><h1>Ventas</h1><button class="primario" id="btn-venta">+ Nueva venta</button></div>
    <div class="barra">
      <label>Desde <input type="date" id="desde"></label>
      <label>Hasta <input type="date" id="hasta"></label>
      <label class="check" style="align-self:end"><input type="checkbox" id="pendientes"> Solo con saldo (cuentas por cobrar)</label>
    </div>
    <div id="lista"></div>`;
  const cargar = () => intentar(async () => {
    const params = new URLSearchParams({ pendientes: $('#pendientes').checked });
    if ($('#desde').value) params.set('desde', $('#desde').value);
    if ($('#hasta').value) params.set('hasta', $('#hasta').value);
    const lista = await api('/api/ventas?' + params);
    const activas = lista.filter((v) => v.estado === 'ACTIVA');
    $('#lista').innerHTML = lista.length ? `
      <p class="suave">${activas.length} venta(s) · Total ${cop(activas.reduce((s, v) => s + v.total, 0))} · Utilidad ${cop(activas.reduce((s, v) => s + v.utilidad, 0))} · Por cobrar ${cop(activas.reduce((s, v) => s + v.saldo, 0))}</p>
      <div class="tabla-contenedor"><table>
      <thead><tr><th>Número</th><th>Fecha</th><th>Cliente</th><th class="num">Total</th><th class="num">Utilidad</th><th class="num">Saldo</th><th>Estado</th><th></th></tr></thead>
      <tbody>${lista.map((v) => `<tr class="${v.estado === 'ANULADA' ? 'inactivo' : ''}">
        <td><strong>${v.numero}</strong>${v.pedidoNumero ? `<br><span class="suave">${v.pedidoNumero}</span>` : ''}</td>
        <td>${fechaHora(v.fechaHora)}</td><td>${esc(v.clienteNombre || 'Cliente general')}</td>
        <td class="num">${cop(v.total)}</td><td class="num">${cop(v.utilidad)}</td>
        <td class="num">${v.saldo ? cop(v.saldo) : '—'}${v.saldo && v.fechaVencimiento ? '<br>' + etiquetaVencimiento(v.fechaVencimiento, v.saldo) : ''}</td>
        <td>${v.estado === 'ANULADA' ? '<span class="etiqueta peligro">Anulada</span>' : v.saldo ? '<span class="etiqueta aviso">Con saldo</span>' : '<span class="etiqueta ok">Pagada</span>'}</td>
        <td class="num"><button class="pequeno" data-ver="${v.id}">Ver</button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="tarjeta vacio">No hay ventas para mostrar.</div>';
    $$('[data-ver]').forEach((b) => b.addEventListener('click', () => verVenta(b.dataset.ver, cargar)));
  });
  ['desde', 'hasta', 'pendientes'].forEach((id) => $('#' + id).addEventListener('change', cargar));
  $('#btn-venta').addEventListener('click', () => nuevaVenta(cargar));
  await cargar();
  if (sessionStorage.getItem('abrirVenta')) {
    sessionStorage.removeItem('abrirVenta');
    nuevaVenta(cargar);
  }
}

async function nuevaVenta(recargar) {
  const [productosLista, clientesLista] = await Promise.all([api('/api/productos?soloActivos=true'), api('/api/clientes')]);
  const carrito = [];
  const m = abrirModal('Nueva venta', `
    <div class="campos">
      <label class="ancho">Buscar producto <input type="search" id="buscar-prod" placeholder="Nombre, código o marca" autocomplete="off"></label>
    </div>
    <div class="resultados" id="resultados" hidden></div>
    <div id="carrito" style="margin-top:1em"></div>
    <div class="campos" style="margin-top:1em">
      <label>Descuento a toda la venta <span class="fila"><select id="desc-tipo" style="width:70px"><option value="">—</option><option value="PORCENTAJE">%</option><option value="VALOR">$</option></select><input type="number" id="desc-valor" min="0" value="0" style="flex:1"></span></label>
      <label>Cliente <select id="cliente"><option value="">Cliente general (contado)</option>${clientesLista.map((c) => `<option value="${c.id}">${esc(c.nombre)}${c.telefono ? ' · ' + esc(c.telefono) : ''}</option>`).join('')}</select></label>
      <div style="align-self:end"><button type="button" class="pequeno" id="cliente-nuevo">+ Cliente nuevo</button></div>
    </div>
    <div class="totales" style="margin:1em 0">
      <span>Subtotal</span><span id="t-subtotal">$0</span>
      <span>Descuento</span><span id="t-descuento">$0</span>
      <span class="grande">Total</span><span class="grande" id="t-total">$0</span>
    </div>
    <div class="campos">
      <label>Valor pagado <input type="number" id="pagado" min="0"></label>
      <label>Método de pago <select id="metodo">${opcionesMetodo('EFECTIVO')}</select></label>
      <label>Vence (si queda saldo) <input type="date" id="vence"></label>
      <label class="ancho">Notas <input id="notas"></label>
    </div>
    <p class="suave" id="info-credito"></p>
    <div class="modal-pie"><button data-cerrar>Cancelar</button><button class="primario" id="confirmar-venta">Confirmar venta</button></div>`, { grande: true });

  const buscar = $('#buscar-prod', m);
  const resultados = $('#resultados', m);
  let pagadoEditado = false;

  const descuentoDe = (tipo, valor, base) => !tipo || !valor ? 0 : Math.min(base, tipo === 'PORCENTAJE' ? Math.round(base * valor / 100) : valor);
  const calcular = () => {
    let subtotal = 0;
    for (const l of carrito) {
      l.total = l.cantidad * l.precio - descuentoDe(l.descTipo, l.descValor, l.cantidad * l.precio);
      subtotal += l.total;
    }
    const desc = descuentoDe($('#desc-tipo', m).value, Number($('#desc-valor', m).value), subtotal);
    const total = subtotal - desc;
    $('#t-subtotal', m).textContent = cop(subtotal);
    $('#t-descuento', m).textContent = desc ? '−' + cop(desc) : '$0';
    $('#t-total', m).textContent = cop(total);
    if (!pagadoEditado) $('#pagado', m).value = total;
    const pagado = Number($('#pagado', m).value || 0);
    const cliente = clientesLista.find((c) => c.id === Number($('#cliente', m).value));
    let info = '';
    if (pagado < total) info = `Queda un saldo de ${cop(total - pagado)} (venta a crédito${cliente ? '' : ': selecciona un cliente'}).`;
    if (cliente && cliente.saldo) info += ` ${esc(cliente.nombre)} ya debe ${cop(cliente.saldo)}.`;
    if (cliente?.limiteCredito) info += ` Límite de crédito: ${cop(cliente.limiteCredito)}.`;
    $('#info-credito', m).innerHTML = info;
    return total;
  };

  const dibujarCarrito = () => {
    $('#carrito', m).innerHTML = carrito.length ? carrito.map((l, i) => `
      <div class="carrito-linea" data-i="${i}">
        <div class="nombre"><strong>${esc(l.nombre)}</strong><br><span class="suave">Disp. ${l.disponible} · Lista ${cop(l.precioLista)}${l.precio < l.costo ? ' · <span class="etiqueta peligro">bajo costo</span>' : ''}</span></div>
        <input type="number" min="1" max="${l.disponible}" value="${l.cantidad}" data-campo="cantidad" aria-label="Cantidad">
        <input type="number" min="0" value="${l.precio}" data-campo="precio" aria-label="Precio unitario">
        <div class="desc"><select data-campo="descTipo" aria-label="Tipo de descuento"><option value="">—</option><option value="PORCENTAJE" ${l.descTipo === 'PORCENTAJE' ? 'selected' : ''}>%</option><option value="VALOR" ${l.descTipo === 'VALOR' ? 'selected' : ''}>$</option></select>
          <input type="number" min="0" value="${l.descValor}" data-campo="descValor" aria-label="Descuento"></div>
        <strong class="num" data-total>${cop(l.total)}</strong>
        <button type="button" class="icono peligro" data-quitar aria-label="Quitar">✕</button>
      </div>`).join('') : '<p class="vacio">Busca productos y agrégalos al carrito.</p>';
    calcular();
  };

  $('#carrito', m).addEventListener('input', (e) => {
    const fila = e.target.closest('[data-i]');
    if (!fila || !e.target.dataset.campo) return;
    const linea = carrito[fila.dataset.i];
    const campo = e.target.dataset.campo;
    linea[campo] = campo === 'descTipo' ? e.target.value : Number(e.target.value || 0);
    calcular();
    fila.querySelector('[data-total]').textContent = cop(linea.total);
  });
  $('#carrito', m).addEventListener('change', (e) => { if (e.target.dataset.campo === 'precio') dibujarCarrito(); });
  $('#carrito', m).addEventListener('click', (e) => {
    if (!e.target.closest('[data-quitar]')) return;
    carrito.splice(e.target.closest('[data-i]').dataset.i, 1);
    dibujarCarrito();
  });

  buscar.addEventListener('input', () => {
    const t = buscar.value.trim().toLowerCase();
    if (!t) { resultados.hidden = true; return; }
    const encontrados = productosLista.filter((p) => (p.nombre + ' ' + p.codigo + ' ' + p.marca).toLowerCase().includes(t)).slice(0, 20);
    resultados.hidden = false;
    resultados.innerHTML = encontrados.map((p) => `<button type="button" data-id="${p.id}" ${p.disponible ? '' : 'disabled'}>
      <span><strong>${esc(p.nombre)}</strong> <span class="suave">${esc(p.marca)} · ${esc(p.codigo)}</span></span>
      <span>${p.disponible ? cop(p.precioVenta) + ' · ' + p.disponible + ' disp.' : '<span class="etiqueta agotado">Agotado</span>'}</span></button>`).join('') || '<p class="vacio">Sin resultados</p>';
  });
  resultados.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const p = productosLista.find((x) => x.id === Number(b.dataset.id));
    const existente = carrito.find((l) => l.productoId === p.id);
    if (existente) {
      if (existente.cantidad < p.disponible) existente.cantidad++;
      else avisar('Stock insuficiente: solo hay ' + p.disponible, 'error');
    } else {
      carrito.push({ productoId: p.id, nombre: p.nombre, disponible: p.disponible, precioLista: p.precioVenta, costo: p.costo, cantidad: 1, precio: p.precioVenta, descTipo: '', descValor: 0, total: 0 });
    }
    buscar.value = '';
    resultados.hidden = true;
    buscar.focus();
    dibujarCarrito();
  });

  ['#desc-tipo', '#desc-valor', '#cliente'].forEach((s) => $(s, m).addEventListener('input', calcular));
  $('#pagado', m).addEventListener('input', () => { pagadoEditado = true; calcular(); });
  $('#cliente-nuevo', m).addEventListener('click', () => {
    const nombre = prompt('Nombre del cliente');
    if (!nombre) return;
    const telefono = prompt('Teléfono (opcional)') || '';
    intentar(async () => {
      const c = await api('/api/clientes', { metodo: 'POST', datos: { nombre, telefono } });
      clientesLista.push(c);
      $('#cliente', m).insertAdjacentHTML('beforeend', `<option value="${c.id}" selected>${esc(c.nombre)}</option>`);
      calcular();
    });
  });

  const enviar = async (confirmarAdvertencias) => {
    const total = calcular();
    if (!carrito.length) return avisar('El carrito está vacío', 'error');
    for (const l of carrito) {
      if (l.cantidad > l.disponible) return avisar(`Stock insuficiente de ${l.nombre}: hay ${l.disponible}`, 'error');
    }
    const datos = {
      clienteId: Number($('#cliente', m).value) || null,
      items: carrito.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, precioUnitario: l.precio, descuentoTipo: l.descTipo || null, descuentoValor: l.descValor || 0 })),
      descuentoTipo: $('#desc-tipo', m).value || null,
      descuentoValor: Number($('#desc-valor', m).value || 0),
      montoPagado: Math.min(total, Number($('#pagado', m).value || 0)),
      metodoPago: $('#metodo', m).value,
      fechaVencimiento: $('#vence', m).value || null,
      notas: $('#notas', m).value,
      confirmarAdvertencias,
    };
    const boton = $('#confirmar-venta', m);
    boton.disabled = true;
    try {
      const v = await api('/api/ventas', { metodo: 'POST', datos });
      cerrarModal();
      avisar(`Venta ${v.numero} registrada`);
      recargar();
      verVenta(v.id, recargar);
    } catch (e) {
      if (e.estado === 409 && e.advertencias) {
        if (confirm('Atención:\n\n• ' + e.advertencias.join('\n• ') + '\n\n¿Deseas confirmar la venta de todas formas?')) {
          boton.disabled = false;
          return enviar(true);
        }
      } else {
        avisar(e.message, 'error');
      }
    }
    boton.disabled = false;
  };
  $('#confirmar-venta', m).addEventListener('click', () => enviar(false));
  dibujarCarrito();
}

async function verVenta(id, recargar) {
  const v = await api('/api/ventas/' + id);
  const anulada = v.estado === 'ANULADA';
  const m = abrirModal('Venta ' + v.numero, `
    <p>${fechaHora(v.fechaHora)} · ${esc(v.clienteNombre || 'Cliente general')} ${anulada ? '<span class="etiqueta peligro">Anulada</span>' : ''}</p>
    ${anulada ? `<p class="tarjeta" style="background:var(--peligro-fondo)">Anulada el ${fechaHora(v.fechaAnulacion)}. Motivo: ${esc(v.motivoAnulacion)}</p>` : ''}
    <div class="tabla-contenedor"><table><thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Desc.</th><th class="num">Total</th><th class="num">Costo PEPS</th></tr></thead><tbody>
      ${v.items.map((i) => `<tr><td>${esc(i.productoNombre)}${i.precioUnitario !== i.precioLista ? `<br><span class="suave">Lista ${cop(i.precioLista)}</span>` : ''}</td><td class="num">${i.cantidad}</td><td class="num">${cop(i.precioUnitario)}</td><td class="num">${i.descuento ? '−' + cop(i.descuento) : ''}</td><td class="num">${cop(i.total)}</td><td class="num">${cop(i.costo)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="totales" style="margin-top:1em">
      <span>Subtotal</span><span>${cop(v.subtotal)}</span>
      ${v.descuentoGlobal ? `<span>Descuento</span><span>−${cop(v.descuentoGlobal)}</span>` : ''}
      ${v.cargoDomicilio ? `<span>Domicilio</span><span>${cop(v.cargoDomicilio)}</span>` : ''}
      <span class="grande">Total</span><span class="grande">${cop(v.total)}</span>
      <span>Costo</span><span>${cop(v.costoTotal)}</span>
      <span>Utilidad estimada</span><strong>${cop(v.utilidad)}</strong>
      <span>Pagado</span><span>${cop(v.pagado)}</span>
      <span>Saldo</span><strong>${cop(v.saldo)}</strong>
    </div>
    ${v.notas ? `<p><strong>Notas:</strong> ${esc(v.notas)}</p>` : ''}
    <h3>Pagos y abonos (comprobantes AC)</h3>
    ${tablaPagos(v.pagos)}
    ${!anulada && v.saldo ? formularioAbono() : ''}
    <div class="modal-pie">
      ${anulada ? '' : '<button class="peligro" id="anular">Anular venta</button>'}
      ${v.clienteTelefono ? `<a class="boton" target="_blank" rel="noopener" href="https://wa.me/${telWa(v.clienteTelefono)}?text=${encodeURIComponent(`Hola ${v.clienteNombre}, gracias por tu compra ${v.numero} por ${cop(v.total)}.${v.saldo ? ' Saldo pendiente: ' + cop(v.saldo) + '.' : ''}`)}">WhatsApp</a>` : ''}
      <a class="boton" href="/admin/recibo.html?id=${v.id}" target="_blank">Recibo PDF</a>
      <button class="primario" data-cerrar>Cerrar</button>
    </div>`, { grande: true });
  $('#form-abono', m)?.addEventListener('submit', (e) => {
    e.preventDefault();
    intentar(async () => {
      await api(`/api/ventas/${id}/pagos`, { metodo: 'POST', datos: leerFormulario(e.target) });
      avisar('Abono registrado');
      recargar?.();
      verVenta(id, recargar);
    });
  });
  $('#anular', m)?.addEventListener('click', () => {
    const motivo = prompt('Motivo de la anulación (obligatorio). Las unidades regresarán al inventario.');
    if (!motivo || !motivo.trim()) return;
    intentar(async () => {
      await api(`/api/ventas/${id}/anular`, { metodo: 'POST', datos: { motivo } });
      avisar('Venta anulada');
      recargar?.();
      verVenta(id, recargar);
    });
  });
}

// =====================================================================
// CLIENTES
// =====================================================================

async function clientes() {
  vista().innerHTML = `
    <div class="cabecera"><h1>Clientes</h1><button class="primario" id="btn-cliente">+ Nuevo cliente</button></div>
    <div class="barra"><input type="search" id="buscar" placeholder="Buscar por nombre, teléfono o documento">
      <label class="check"><input type="checkbox" id="con-saldo"> Solo con deuda</label></div>
    <div id="lista"></div>`;
  const cargar = () => intentar(async () => {
    let lista = await api('/api/clientes?q=' + encodeURIComponent($('#buscar').value));
    if ($('#con-saldo').checked) lista = lista.filter((c) => c.saldo > 0);
    $('#lista').innerHTML = lista.length ? `<div class="tabla-contenedor"><table>
      <thead><tr><th>Nombre</th><th>Teléfono</th><th>Documento</th><th class="num">Saldo</th><th>Última compra</th><th></th></tr></thead>
      <tbody>${lista.map((c) => `<tr><td><strong>${esc(c.nombre)}</strong></td><td>${esc(c.telefono || '')}</td><td>${esc(c.documento || '')}</td>
        <td class="num">${c.saldo ? `<span class="etiqueta aviso">${cop(c.saldo)}</span>` : '—'}</td><td>${fecha(c.ultimaCompra) || '—'}</td>
        <td class="num"><button class="pequeno" data-ver="${c.id}">Ver</button> <button class="pequeno" data-editar="${c.id}">Editar</button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="tarjeta vacio">No hay clientes.</div>';
    $$('[data-ver]').forEach((b) => b.addEventListener('click', () => intentar(() => verCliente(b.dataset.ver, cargar))));
    $$('[data-editar]').forEach((b) => b.addEventListener('click', () => formularioCliente(lista.find((c) => c.id === Number(b.dataset.editar)), cargar)));
  });
  let espera;
  $('#buscar').addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(cargar, 250); });
  $('#con-saldo').addEventListener('change', cargar);
  $('#btn-cliente').addEventListener('click', () => formularioCliente(null, cargar));
  await cargar();
}

function formularioCliente(c, recargar) {
  const m = abrirModal(c ? 'Editar cliente' : 'Nuevo cliente', `
    <form id="form-cliente" class="campos">
      <label class="ancho">Nombre * <input name="nombre" required value="${esc(c?.nombre)}"></label>
      <label>Teléfono <input name="telefono" type="tel" value="${esc(c?.telefono)}"></label>
      <label>Documento <input name="documento" value="${esc(c?.documento)}"></label>
      <label class="ancho">Dirección <input name="direccion" value="${esc(c?.direccion)}"></label>
      <label>Límite de crédito (opcional) <input name="limiteCredito" type="number" min="0" data-numero value="${c?.limiteCredito ?? ''}"></label>
    </form>
    <div class="modal-pie"><button data-cerrar>Cancelar</button><button class="primario" form="form-cliente">Guardar</button></div>`);
  $('#form-cliente', m).addEventListener('submit', (e) => {
    e.preventDefault();
    intentar(async () => {
      await api(c ? '/api/clientes/' + c.id : '/api/clientes', { metodo: c ? 'PUT' : 'POST', datos: leerFormulario(e.target) });
      cerrarModal();
      avisar('Cliente guardado');
      recargar();
    });
  });
}

async function verCliente(id, recargar) {
  const d = await api('/api/clientes/' + id);
  const c = d.cliente;
  const m = abrirModal(esc(c.nombre), `
    <p class="suave">${[c.telefono, c.documento, c.direccion].filter(Boolean).map(esc).join(' · ') || 'Sin datos de contacto'}${c.limiteCredito ? ' · Límite ' + cop(c.limiteCredito) : ''}</p>
    <div class="indicadores">
      <div class="tarjeta indicador"><div class="titulo">Saldo pendiente</div><div class="valor">${cop(c.saldo)}</div></div>
      <div class="tarjeta indicador"><div class="titulo">Compras</div><div class="valor">${d.ventas.filter((v) => v.estado === 'ACTIVA').length}</div><div class="detalle">Última: ${fecha(c.ultimaCompra) || '—'}</div></div>
    </div>
    ${c.saldo ? `<h3>Registrar abono</h3><p class="suave">Se aplica a las deudas más antiguas primero.</p>${formularioAbono()}` : ''}
    <h3 style="margin-top:1em">Historial de compras</h3>
    <div class="tabla-contenedor"><table><thead><tr><th>Venta</th><th>Fecha</th><th class="num">Total</th><th class="num">Descuentos</th><th class="num">Saldo</th><th></th></tr></thead><tbody>
      ${d.ventas.map((v) => `<tr class="${v.estado === 'ANULADA' ? 'inactivo' : ''}"><td>${v.numero}${v.estado === 'ANULADA' ? ' (anulada)' : ''}</td><td>${fechaHora(v.fechaHora)}</td><td class="num">${cop(v.total)}</td>
        <td class="num">${cop(v.descuentoGlobal + v.items.reduce((s, i) => s + i.descuento, 0))}</td><td class="num">${v.saldo ? cop(v.saldo) : '—'}</td><td class="num"><button class="pequeno" data-venta="${v.id}">Ver</button></td></tr>`).join('') || '<tr><td colspan="6" class="vacio">Sin compras</td></tr>'}
    </tbody></table></div>
    <h3 style="margin-top:1em">Pagos y abonos</h3>
    ${tablaPagos(d.pagos)}
    <div class="modal-pie">${c.telefono ? `<a class="boton" target="_blank" rel="noopener" href="https://wa.me/${telWa(c.telefono)}">WhatsApp</a>` : ''}<button class="primario" data-cerrar>Cerrar</button></div>`, { grande: true });
  $('#form-abono', m)?.addEventListener('submit', (e) => {
    e.preventDefault();
    intentar(async () => {
      const r = await api(`/api/clientes/${id}/abonos`, { metodo: 'POST', datos: leerFormulario(e.target) });
      avisar(`Abono ${r.numero} registrado`);
      recargar();
      verCliente(id, recargar);
    });
  });
  $$('[data-venta]', m).forEach((b) => b.addEventListener('click', () => intentar(() => verVenta(b.dataset.venta, () => verCliente(id, recargar)))));
}

// =====================================================================
// PEDIDOS DEL CATALOGO
// =====================================================================

const ESTADOS = {
  PENDIENTE: ['Pendiente', 'aviso'], CONFIRMADO: ['Confirmado', 'ok'], EN_PREPARACION: ['En preparación', 'ok'],
  LISTO: ['Listo para entrega', 'ok'], ENTREGADO: ['Entregado', 'neutra'], CANCELADO: ['Cancelado', 'peligro'],
};
const SIGUIENTE = { PENDIENTE: 'CONFIRMADO', CONFIRMADO: 'EN_PREPARACION', EN_PREPARACION: 'LISTO', LISTO: 'ENTREGADO' };

async function pedidos() {
  vista().innerHTML = `
    <div class="cabecera"><h1>Pedidos del catálogo</h1></div>
    <div class="barra"><select id="filtro"><option value="activos">En curso</option><option value="PENDIENTE">Pendientes</option><option value="todos">Todos</option></select></div>
    <p class="suave">Los pedidos pendientes reservan existencias. Al confirmar se crea la venta (pendiente de pago); al cancelar se liberan las unidades.</p>
    <div id="lista" class="lista-pedidos"></div>`;
  const cargar = () => intentar(async () => {
    const filtro = $('#filtro').value;
    const lista = (await api('/api/pedidos')).filter((p) => filtro === 'todos' || (filtro === 'activos' ? !['ENTREGADO', 'CANCELADO'].includes(p.estado) : p.estado === filtro));
    $('#lista').innerHTML = lista.map((p) => `<article class="tarjeta pedido-tarjeta">
      <div class="fila"><strong>${p.numero}</strong><span class="espacio"></span><span class="etiqueta ${ESTADOS[p.estado][1]}">${ESTADOS[p.estado][0]}</span></div>
      <div class="suave">${fechaHora(p.fechaHora)}</div>
      <div><strong>${esc(p.nombreCliente)}</strong> · ${esc(p.telefono)}</div>
      <div>${p.tipoEntrega === 'DOMICILIO' ? '🛵 Domicilio: ' + esc(p.direccion) : '🏬 Recoge en tienda'}</div>
      <ul style="margin:.2em 0;padding-left:1.2em">${p.items.map((i) => `<li>${i.cantidad} × ${esc(i.productoNombre)} — ${cop(i.total)}</li>`).join('')}</ul>
      ${p.costoDomicilio ? `<div class="suave">Domicilio ${cop(p.costoDomicilio)}</div>` : ''}
      ${p.observaciones ? `<div class="suave">“${esc(p.observaciones)}”</div>` : ''}
      <div class="fila"><strong>Total ${cop(p.total)}</strong><span class="espacio"></span>${p.ventaNumero ? `<button class="pequeno" data-venta="${p.ventaId}">${p.ventaNumero}</button>` : ''}</div>
      <div class="fila">
        ${SIGUIENTE[p.estado] ? `<button class="primario pequeno" data-estado="${SIGUIENTE[p.estado]}" data-id="${p.id}">${p.estado === 'PENDIENTE' ? 'Confirmar' : 'Marcar: ' + ESTADOS[SIGUIENTE[p.estado]][0]}</button>` : ''}
        ${!['ENTREGADO', 'CANCELADO'].includes(p.estado) ? `<button class="pequeno peligro" data-estado="CANCELADO" data-id="${p.id}">Cancelar</button>` : ''}
        <a class="boton pequeno" target="_blank" rel="noopener" href="https://wa.me/${telWa(p.telefono)}?text=${encodeURIComponent(`Hola ${p.nombreCliente}, te escribimos de Vivanet Colección sobre tu pedido ${p.numero}.`)}">WhatsApp</a>
      </div></article>`).join('') || '<div class="tarjeta vacio">No hay pedidos.</div>';
    $$('[data-estado]').forEach((b) => b.addEventListener('click', () => cambiarEstadoPedido(lista.find((p) => p.id === Number(b.dataset.id)), b.dataset.estado, cargar)));
    $$('[data-venta]').forEach((b) => b.addEventListener('click', () => intentar(() => verVenta(b.dataset.venta, cargar))));
  });
  $('#filtro').addEventListener('change', cargar);
  await cargar();
}

function cambiarEstadoPedido(p, estado, recargar) {
  if (estado === 'CANCELADO' && !confirm(`¿Cancelar el pedido ${p.numero}?${p.ventaNumero ? ' La venta ' + p.ventaNumero + ' se anulará y las unidades volverán al inventario.' : ''}`)) return;
  intentar(async () => {
    const actualizado = await api(`/api/pedidos/${p.id}/estado`, { metodo: 'POST', datos: { estado } });
    avisar(`Pedido ${p.numero}: ${ESTADOS[estado][0]}`);
    recargar();
    actualizarContadorPedidos();
    if (estado === 'CONFIRMADO') {
      const texto = `Hola ${p.nombreCliente}, ¡tu pedido ${p.numero} de Vivanet Colección fue confirmado! Total: ${cop(p.total)}. Coordinemos la fecha y hora de ${p.tipoEntrega === 'DOMICILIO' ? 'entrega' : 'recogida'}.`;
      abrirModal('Pedido confirmado', `<p>Se creó la venta <strong>${actualizado.ventaNumero}</strong>. Avísale al cliente por WhatsApp:</p>
        <div class="modal-pie"><button data-cerrar>Ahora no</button><a class="boton primario" target="_blank" rel="noopener" href="https://wa.me/${telWa(p.telefono)}?text=${encodeURIComponent(texto)}">Enviar confirmación por WhatsApp</a></div>`);
    }
  });
}

// =====================================================================
// CONFIGURACION
// =====================================================================

async function configuracion() {
  const c = await api('/api/configuracion');
  const urlCatalogo = location.origin + '/catalogo/';
  const check = (nombre, texto) => `<label class="check"><input type="checkbox" name="${nombre}" ${c[nombre] ? 'checked' : ''}> ${texto}</label>`;
  const campo = (nombre, texto, tipo = 'text', extra = '') => `<label>${texto} <input name="${nombre}" type="${tipo}" value="${esc(c[nombre] ?? '')}" ${extra}></label>`;
  vista().innerHTML = `
    <div class="cabecera"><h1>Configuración</h1></div>
    <form id="form-config">
      <section class="tarjeta" style="margin-bottom:1em"><h2>Datos del negocio</h2><div class="campos">
        ${campo('nombreNegocio', 'Nombre comercial')}${campo('telefono', 'Teléfono', 'tel')}
        ${campo('whatsapp', 'WhatsApp que recibe pedidos', 'tel', 'placeholder="3001234567"')}${campo('correo', 'Correo', 'email')}
        ${campo('direccion', 'Dirección')}${campo('horarios', 'Horarios de atención', 'text', 'placeholder="Lun a Sáb 9:00 a.m. – 7:00 p.m."')}
        ${campo('instagram', 'Instagram (enlace)', 'url')}${campo('facebook', 'Facebook (enlace)', 'url')}${campo('tiktok', 'TikTok (enlace)', 'url')}
      </div></section>
      <section class="tarjeta" style="margin-bottom:1em"><h2>Precios y entregas</h2><div class="campos">
        <label>Incremento sobre el costo (%) <input name="porcentajeIncremento" type="number" min="0" data-numero value="${c.porcentajeIncremento}"></label>
        <label>Costo fijo del domicilio <input name="costoDomicilio" type="number" min="0" data-numero value="${c.costoDomicilio}"></label>
      </div><p class="suave">100% = el precio sugerido es el doble del costo. Se redondea al millar más cercano.</p></section>
      <section class="tarjeta" style="margin-bottom:1em"><h2>Catálogo digital</h2>
        <div class="fila">${check('catalogoHabilitado', 'Catálogo habilitado')}${check('mostrarAgotados', 'Mostrar productos agotados con etiqueta «Agotado» (si no, se ocultan)')}</div>
        <div class="fila" style="margin-top:1em;align-items:flex-start">
          <div id="qr"></div>
          <div style="flex:1;min-width:220px">
            <p>Enlace público: <a href="${urlCatalogo}" target="_blank" rel="noopener">${urlCatalogo}</a></p>
            <div class="fila"><button type="button" id="copiar">Copiar enlace</button>
              <a class="boton" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('Mira nuestro catálogo de Vivanet Colección: ' + urlCatalogo)}">Compartir por WhatsApp</a>
              <a class="boton" id="descargar-qr" download="catalogo-vivanet-qr.png">Descargar QR</a></div>
          </div>
        </div>
      </section>
      <section class="tarjeta" style="margin-bottom:1em"><h2>Recibos</h2>
        <div class="fila">${check('reciboMostrarLogo', 'Logo')}${check('reciboMostrarDireccion', 'Dirección')}${check('reciboMostrarTelefono', 'Teléfono')}${check('reciboMostrarCliente', 'Datos del cliente')}</div>
        <label style="margin-top:.8em">Notas al pie del recibo <textarea name="notasRecibo">${esc(c.notasRecibo)}</textarea></label>
      </section>
      <div class="fila fin"><button class="primario">Guardar configuración</button></div>
    </form>
    <section class="tarjeta" style="margin-top:1em"><h2>Logo (marquilla)</h2>
      ${c.tieneLogo ? `<img src="/api/public/logo?${Date.now()}" alt="Logo" style="max-height:90px;margin-bottom:.8em;display:block">` : '<p class="suave">Aún no hay logo.</p>'}
      <form id="form-logo" class="fila"><input type="file" name="archivo" accept="image/*" required style="flex:1"><button>Subir logo</button></form>
    </section>`;

  if (window.qrcode) {
    const qr = qrcode(0, 'M');
    qr.addData(urlCatalogo);
    qr.make();
    const imagen = qr.createDataURL(8, 2);
    $('#qr').innerHTML = `<img src="${imagen}" alt="Código QR del catálogo">`;
    $('#descargar-qr').href = imagen;
  } else {
    $('#descargar-qr').hidden = true;
  }
  $('#copiar').addEventListener('click', () => navigator.clipboard.writeText(urlCatalogo).then(() => avisar('Enlace copiado')));
  $('#form-config').addEventListener('submit', (e) => {
    e.preventDefault();
    intentar(async () => {
      await api('/api/configuracion', { metodo: 'PUT', datos: { ...leerFormulario(e.target), tieneLogo: c.tieneLogo } });
      avisar('Configuración guardada');
    });
  });
  $('#form-logo').addEventListener('submit', (e) => {
    e.preventDefault();
    intentar(async () => {
      await api('/api/configuracion/logo', { metodo: 'POST', formulario: new FormData(e.target) });
      avisar('Logo actualizado');
      configuracion();
    });
  });
}

// ---------- Inicio ----------
navegar();
