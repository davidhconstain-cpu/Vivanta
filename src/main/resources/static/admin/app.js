// =====================================================================
// BeautyStock - panel de administracion de Vivanta Coleccion
// Cada "vista" (Panel, Ventas, Inventario...) es una funcion que dibuja
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
const fechaCorta = (iso) => iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const fechaHora = (iso) => iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
const hoyISO = () => new Date().toLocaleDateString('en-CA');
const METODOS = { EFECTIVO: 'Efectivo', NEQUI: 'Nequi', TRANSFERENCIA: 'Transferencia' };
const opcionesMetodo = (sel) => Object.entries(METODOS).map(([v, t]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${t}</option>`).join('');
const telWa = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.length === 10 ? '57' + d : d; };
const normalizar = (t) => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Foto principal del producto o, si no tiene, el isotipo de Vivanta. */
const fotoProducto = (p) => p.imagenes?.length ? `/api/public/imagenes/${p.imagenes[0]}` : '/img/isotipo-vivanta.png';

/** Opciones tipo "pastilla" (radios), como en el diseno. */
const pastillas = (nombre, opciones, elegida) => opciones.map(([valor, texto]) =>
  `<label class="opcion"><input type="radio" name="${nombre}" value="${valor}" ${valor === elegida ? 'checked' : ''}>${texto}</label>`).join('');

/** Iconos de linea (mismo estilo del menu). */
const ICONOS = {
  alerta: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/>',
  caja: '<path d="M3 8l9-5 9 5v8l-9 5-9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chat: '<path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.4-5.4A8.5 8.5 0 1 1 21 12z"/>',
  campana: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15L6 17z"/><path d="M10 21h4"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  whatsapp: '<path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.4-5.4A8.5 8.5 0 1 1 21 12z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1c-1-.5-1.5-1-2-2l1-1-1-2L9 9.5z"/>',
};
const icono = (nombre, tam = 20) => `<svg class="icono-svg" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[nombre]}</svg>`;

/** Datos del negocio (nombre para mensajes de WhatsApp). Se cargan al iniciar. */
let negocio = { nombreNegocio: 'Vivanta Colección' };

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

/** Cambia cada vez que se abre otra vista (ver navegar). */
let generacionVista = 0;

/** Ejecuta una accion y muestra el error si falla. */
async function intentar(accion) {
  const generacion = generacionVista;
  try {
    return await accion();
  } catch (e) {
    // Si el usuario cambio de vista mientras algo cargaba, los elementos ya no existen:
    // ese error de pantalla no importa. Los errores del servidor si se muestran siempre.
    if (generacion !== generacionVista && e instanceof TypeError) return;
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
  const primero = $('input:not([type=hidden]):not([type=radio]), select, textarea', fondo);
  if (primero) primero.focus();
  return fondo;
}
function cerrarModal() { $('#modal')?.remove(); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });

/** Ventana para pedir un motivo obligatorio (anulaciones). Devuelve el texto o null. */
function pedirMotivo(titulo, explicacion, textoBoton, ejemplo) {
  return new Promise((resolver) => {
    const m = abrirModal(titulo, `
      <form id="form-motivo">
        <p>${explicacion}</p>
        <label>Motivo (obligatorio) <input name="motivo" required placeholder="${esc(ejemplo)}"></label>
      </form>
      <div class="modal-pie"><button data-cerrar>Volver</button><button class="primario" form="form-motivo">${textoBoton}</button></div>`);
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-cerrar]')) resolver(null); });
    $('#form-motivo', m).addEventListener('submit', (e) => {
      e.preventDefault();
      const motivo = e.target.motivo.value.trim();
      cerrarModal();
      resolver(motivo || null);
    });
  });
}

/** Lee los campos de un formulario como objeto. Los campos con data-numero se convierten en numero. */
function leerFormulario(form) {
  const datos = {};
  for (const campo of form.elements) {
    if (!campo.name) continue;
    if (campo.type === 'radio') { if (campo.checked) datos[campo.name] = campo.value; continue; }
    if (campo.type === 'checkbox') datos[campo.name] = campo.checked;
    else if (campo.dataset.numero !== undefined) datos[campo.name] = campo.value === '' ? null : Number(campo.value);
    else datos[campo.name] = campo.value.trim() === '' ? null : campo.value.trim();
  }
  return datos;
}

const vista = () => $('#vista');

/**
 * Reduce una foto antes de subirla (las del celular pesan varios MB): maximo 1600 px
 * de lado, en JPEG. Si algo falla, se sube la original.
 */
async function reducirFoto(archivo, maximo = 1600) {
  if (!archivo.type.startsWith('image/') || archivo.type === 'image/gif') return archivo;
  try {
    const imagen = await createImageBitmap(archivo);
    const escala = Math.min(1, maximo / Math.max(imagen.width, imagen.height));
    if (escala === 1 && archivo.size < 500 * 1024) return archivo;
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(imagen.width * escala);
    lienzo.height = Math.round(imagen.height * escala);
    const g = lienzo.getContext('2d');
    g.fillStyle = '#ffffff'; // fondo blanco para imagenes PNG con transparencia
    g.fillRect(0, 0, lienzo.width, lienzo.height);
    g.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise((listo) => lienzo.toBlob(listo, 'image/jpeg', 0.85));
    return blob ? new File([blob], archivo.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : archivo;
  } catch {
    return archivo;
  }
}

/** Arma el formulario de envio con las fotos ya reducidas. */
async function formularioFotos(archivos, campo = 'archivos') {
  const envio = new FormData();
  for (const archivo of archivos) envio.append(campo, await reducirFoto(archivo));
  return envio;
}

/**
 * En el celular las tablas se muestran como tarjetas (ver index.html). Para que cada dato
 * diga que es, se copia el encabezado de su columna en data-label. Se hace solo cada vez
 * que cambia la pagina, asi ninguna vista tiene que acordarse de hacerlo.
 */
function etiquetarTablas() {
  $$('.tabla-contenedor table').forEach((tabla) => {
    const titulos = $$('thead th', tabla).map((th) => th.textContent.trim());
    $$('tbody tr', tabla).forEach((fila) => [...fila.children].forEach((celda, i) => {
      if (titulos[i] && i > 0 && !celda.hasAttribute('colspan')) celda.dataset.label = titulos[i];
    }));
  });
}
new MutationObserver(etiquetarTablas).observe(document.body, { childList: true, subtree: true });

// ---------- Navegacion ----------

const vistas = {
  panel, ventas, 'nueva-venta': nuevaVenta, pedidos, inventario, compras, clientes, configuracion,
  productos: inventario, // la antigua seccion "Productos" ahora es parte de Inventario
};
/** Opcion del menu que se marca para cada vista. */
const MENU_DE = { 'nueva-venta': 'ventas', productos: 'inventario' };

let vistaActual = null;
/** Si una vista tiene trabajo sin guardar (venta a medias), devuelve true para preguntar antes de salir. */
let hayCambiosSinGuardar = null;

async function navegar() {
  const nombre = location.hash.slice(1) || 'panel';
  if (hayCambiosSinGuardar?.() && nombre !== vistaActual
      && !confirm('Tienes una venta sin terminar. ¿Salir y descartarla?')) {
    history.replaceState(null, '', '#' + vistaActual);
    return;
  }
  hayCambiosSinGuardar = null;
  vistaActual = nombre;
  generacionVista++;
  const dibujar = vistas[nombre] || panel;
  $$('#menu a').forEach((a) => a.classList.toggle('activo', a.dataset.vista === (MENU_DE[nombre] || nombre)));
  $('#app').classList.remove('menu-abierto');
  cerrarModal();
  vista().innerHTML = '<p class="suave">Cargando…</p>';
  window.scrollTo(0, 0);
  await intentar(dibujar);
  actualizarContadorPedidos();
}
window.addEventListener('hashchange', navegar);
$('#abrir-menu').addEventListener('click', () => $('#app').classList.toggle('menu-abierto'));
$('#fondo-menu').addEventListener('click', () => $('#app').classList.remove('menu-abierto'));

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
    actualizarContadorPedidos(); // asi ves los pedidos nuevos del catalogo sin recargar
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

const ALERTA_ESTILO = {
  stock: ['alerta', '', 'bajo'], agotado: ['caja', 'rosa', 'agotado'], 'por-vencer': ['reloj', '', 'bajo'],
  vencido: ['reloj', 'rosa', 'peligro'], pedido: ['chat', 'rosa', 'numero'],
};

async function panel() {
  const d = await api('/api/panel');
  const hoy = new Date();
  const mes = hoy.toLocaleDateString('es-CO', { month: 'long' });
  const pasos = [
    [d.whatsappConfigurado, 'Configura el WhatsApp y los datos del negocio', 'configuracion'],
    [d.productosActivos > 0, 'Crea tus productos (con foto)', 'inventario'],
    [d.unidadesInventario > 0, 'Registra una entrada de mercancía para cargar existencias', 'compras'],
  ];
  const guia = pasos.every(([listo]) => listo) ? '' : `
    <section class="tarjeta" style="border-left:4px solid var(--principal)">
      <h2>Primeros pasos</h2>
      <ol style="margin:0;padding-left:1.3em;display:flex;flex-direction:column;gap:.5em">
        ${pasos.map(([listo, texto, destino]) => `<li>${listo ? `✓ <s class="suave">${texto}</s>` : `<a href="#${destino}">${texto}</a>`}</li>`).join('')}
        <li>Comparte tu catálogo desde <a href="#configuracion">Configuración</a> (enlace, QR o WhatsApp).</li>
      </ol>
    </section>`;
  const meta = (titulo, valor, objetivo, etiqueta) => {
    const avance = objetivo ? Math.min(100, Math.round(valor * 100 / objetivo)) : 0;
    return `<div class="meta">
      <div class="encabezado"><strong>${titulo}</strong><span class="suave">${cop(valor)} de ${cop(objetivo)}</span></div>
      <div class="progreso" role="progressbar" aria-label="${etiqueta}" aria-valuenow="${avance}" aria-valuemin="0" aria-valuemax="100"><div style="width:${avance}%"></div></div>
      <div class="suave" style="margin-top:8px;font-size:13px">${avance} % de la meta mensual</div>
    </div>`;
  };
  const tieneMetas = d.metaVentasMes > 0 || d.metaUtilidadMes > 0;

  vista().innerHTML = `
    <header class="cabecera">
      <div>
        <h1>Panel principal</h1>
        <p class="sub">${hoy.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^./, (l) => l.toUpperCase())}</p>
      </div>
      <div class="acciones">
        <button type="button" class="boton-campana" id="ir-alertas" aria-label="Ver alertas">${icono('campana')}${d.alertas.length ? '<span class="punto"></span>' : ''}</button>
        <a class="boton" href="#compras">Entrada de mercancía</a>
        <a class="boton primario" href="#nueva-venta">${icono('mas', 18)}Nueva venta</a>
      </div>
    </header>
    ${guia}
    <section class="indicadores" aria-label="Resumen del día">
      <div class="indicador rosa"><span class="titulo">Ventas del día</span><span class="valor">${cop(d.ventasHoy)}</span><span class="detalle">${d.numeroVentasHoy} venta(s) registradas hoy</span></div>
      <div class="indicador amarillo"><span class="titulo">Utilidad estimada del día</span><span class="valor">${cop(d.utilidadHoy)}</span><span class="detalle">Calculada con costo PEPS</span></div>
      <div class="indicador"><span class="titulo">Cuentas por cobrar</span><span class="valor">${cop(d.cuentasPorCobrar)}</span><span class="detalle">${d.clientesConSaldo} cliente(s) con saldo pendiente</span></div>
      <div class="indicador"><span class="titulo">Inventario actual</span><span class="valor">${d.unidadesInventario.toLocaleString('es-CO')} und.</span><span class="detalle">en ${d.productosActivos} productos activos</span></div>
    </section>
    <div class="dos-columnas">
      <section class="tarjeta estrecha">
        <h2>Metas de ${mes}</h2>
        ${tieneMetas
          ? (d.metaVentasMes ? meta('Ventas del mes', d.ventasMes, d.metaVentasMes, 'Avance de la meta de ventas') : '')
            + (d.metaUtilidadMes ? meta('Utilidad del mes', d.utilidadMes, d.metaUtilidadMes, 'Avance de la meta de utilidad') : '')
          : `<p class="suave">Ventas del mes: <strong>${cop(d.ventasMes)}</strong> · Utilidad: <strong>${cop(d.utilidadMes)}</strong></p>
             <p><a href="#configuracion">Define tus metas mensuales</a> para ver aquí el avance.</p>`}
        <p class="suave" style="margin:20px 0 0;font-size:13px">Por pagar a proveedores: ${cop(d.cuentasPorPagar)} · Valor del inventario al costo: ${cop(d.valorInventario)}</p>
      </section>
      <section class="tarjeta ancha" id="alertas" style="padding-bottom:12px">
        <h2 style="margin-bottom:8px">Alertas</h2>
        ${d.alertas.length ? `<ul class="lista-alertas">${d.alertas.map((a) => {
          const [ic, tono, etiqueta] = ALERTA_ESTILO[a.tipo] || ALERTA_ESTILO.stock;
          return `<li><a href="#${a.vista}"><span class="tile ${tono}">${icono(ic)}</span>
            <span class="texto"><strong>${esc(a.titulo)}</strong><span>${esc(a.detalle)}</span></span>
            <span class="etiqueta ${etiqueta}">${esc(a.etiqueta)}</span></a></li>`;
        }).join('')}</ul>` : '<p class="suave">Todo en orden. No hay alertas.</p>'}
      </section>
    </div>`;
  $('#ir-alertas').addEventListener('click', () => $('#alertas').scrollIntoView({ behavior: 'smooth' }));
}

// =====================================================================
// INVENTARIO (productos, existencias, lotes y movimientos)
// =====================================================================

let categoriasCache = [];

function estadoProducto(p) {
  if (!p.activo) return '<span class="etiqueta neutra">Desactivado</span>';
  if (p.existencias === 0) return '<span class="etiqueta agotado">Agotado</span>';
  if (p.stockBajo) return '<span class="etiqueta bajo">Stock bajo</span>';
  return '<span class="etiqueta ok">Disponible</span>';
}

async function inventario() {
  categoriasCache = await api('/api/categorias');
  vista().innerHTML = `
    <header class="cabecera">
      <div><h1>Inventario</h1><p class="sub">Existencias por producto y por lote</p></div>
      <div class="acciones">
        <button type="button" id="btn-categorias">Categorías</button>
        <button type="button" class="contorno" id="btn-nuevo">${icono('mas', 18)}Nuevo producto</button>
        <a class="boton primario" href="#compras">Registrar compra</a>
      </div>
    </header>
    <div class="pestanas" role="tablist"><button class="activo" data-pestana="productos">Productos</button><button data-pestana="movimientos">Movimientos</button></div>
    <div id="contenido-inventario" style="display:flex;flex-direction:column;gap:20px"></div>`;
  $('#btn-nuevo').addEventListener('click', () => formularioProducto(null, inventario));
  $('#btn-categorias').addEventListener('click', () => gestionarCategorias(inventario));
  $$('[data-pestana]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-pestana]').forEach((x) => x.classList.toggle('activo', x === b));
    intentar(b.dataset.pestana === 'productos' ? listaProductos : movimientos);
  }));
  await listaProductos();
}

async function listaProductos() {
  const todos = await api('/api/productos');
  let filtro = 'activos';
  let seleccionado = null;
  $('#contenido-inventario').innerHTML = `
    <div class="barra">
      <label style="flex:1 1 280px;max-width:420px">Buscar por nombre, código, categoría o marca
        <input id="buscar-inv" type="search" placeholder="Buscar producto"></label>
      <label>Categoría <select id="filtro-categoria"><option value="">Todas</option>${categoriasCache.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select></label>
      <div class="chips" role="group" aria-label="Filtrar por estado">
        <button type="button" class="chip" data-filtro="activos" aria-pressed="true">Todos</button>
        <button type="button" class="chip" data-filtro="bajo" aria-pressed="false">Stock bajo</button>
        <button type="button" class="chip" data-filtro="agotados" aria-pressed="false">Agotados</button>
        <button type="button" class="chip" data-filtro="inactivos" aria-pressed="false">Desactivados</button>
      </div>
    </div>
    <section id="tabla-productos"></section>
    <section id="detalle-producto"></section>`;

  const dibujar = () => {
    const texto = normalizar($('#buscar-inv').value);
    const categoria = Number($('#filtro-categoria').value) || null;
    const lista = todos.filter((p) => ({
      activos: p.activo, bajo: p.activo && p.stockBajo && p.existencias > 0, agotados: p.activo && p.existencias === 0, inactivos: !p.activo,
    }[filtro])
      && (!categoria || p.categoriaId === categoria)
      && (!texto || normalizar(`${p.nombre} ${p.codigo} ${p.marca} ${p.categoriaNombre || ''}`).includes(texto)));
    const activos = todos.filter((p) => p.activo).length;
    $('#tabla-productos').innerHTML = lista.length ? `
      <div class="tabla-contenedor"><table>
        <caption class="suave" style="text-align:left;padding:10px 14px">Toca un producto para ver sus lotes y opciones</caption>
        <thead><tr><th>Producto</th><th>Marca</th><th>Categoría</th><th class="num">Existencia</th><th class="num">Mínimo</th><th class="num">Costo vigente</th><th class="num">Precio</th><th>Estado</th></tr></thead>
        <tbody>${lista.map((p) => `<tr class="seleccionable ${p.activo ? '' : 'inactivo'} ${p.id === seleccionado ? 'seleccionada' : ''}" data-id="${p.id}" tabindex="0">
          <td><div class="producto-celda"><img class="miniatura" src="${fotoProducto(p)}" alt=""><div><strong>${esc(p.nombre)}</strong><span>${esc(p.codigo)}</span></div></div></td>
          <td>${esc(p.marca)}</td><td>${esc(p.categoriaNombre || '—')}</td>
          <td class="num">${p.existencias}${p.reservado ? ` <span class="suave" title="Reservadas por pedidos">(${p.reservado} res.)</span>` : ''}</td>
          <td class="num">${p.stockMinimo}</td><td class="num">${cop(p.costo)}</td><td class="num">${cop(p.precioVenta)}</td>
          <td>${estadoProducto(p)}</td></tr>`).join('')}</tbody>
      </table><div class="pie-tabla">Mostrando ${lista.length} de ${activos} productos activos</div></div>`
      : `<div class="tarjeta vacio">${todos.length ? 'No hay productos con ese filtro.' : 'Aún no tienes productos. Crea el primero con «Nuevo producto».'}</div>`;
    $$('#tabla-productos tr[data-id]').forEach((fila) => {
      const abrir = () => { seleccionado = Number(fila.dataset.id); dibujar(); intentar(() => detalleProducto(todos.find((p) => p.id === seleccionado))); };
      fila.addEventListener('click', abrir);
      fila.addEventListener('keydown', (e) => { if (e.key === 'Enter') abrir(); });
    });
  };

  let espera;
  $('#buscar-inv').addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(dibujar, 150); });
  $('#filtro-categoria').addEventListener('change', dibujar);
  $$('[data-filtro]').forEach((b) => b.addEventListener('click', () => {
    filtro = b.dataset.filtro;
    $$('[data-filtro]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    dibujar();
  }));
  dibujar();
}

/** Lotes y acciones del producto elegido (debajo de la tabla, como en el diseno). */
async function detalleProducto(p) {
  const lotes = await api(`/api/inventario/${p.id}/lotes`);
  const recargar = inventario;
  $('#detalle-producto').innerHTML = `
    <div class="tarjeta" style="display:flex;flex-direction:column;gap:16px">
      <div class="fila" style="justify-content:space-between">
        <h2 style="margin:0">Lotes de ${esc(p.nombre)}</h2>
        <span class="suave">Total disponible: <strong>${p.disponible}</strong> unidad(es)${p.reservado ? ` · ${p.reservado} reservada(s)` : ''}</span>
      </div>
      <div class="acciones-producto">
        <button type="button" class="pequeno" data-accion="editar">Editar producto</button>
        <button type="button" class="pequeno" data-accion="fotos">Fotos (${p.imagenes.length})</button>
        <button type="button" class="pequeno" data-accion="ajustar">Ajustar existencias</button>
        <button type="button" class="pequeno" data-accion="historial">Historial de precios</button>
        <button type="button" class="pequeno ${p.activo ? 'peligro' : ''}" data-accion="activo">${p.activo ? 'Desactivar' : 'Activar'}</button>
        ${p.activo ? '' : '<button type="button" class="pequeno peligro" data-accion="eliminar">Eliminar</button>'}
      </div>
      <p class="suave" style="margin:0">Las ventas descuentan primero del lote más antiguo (PEPS).${p.precioVenta !== p.precioSugerido ? ` Precio sugerido con el costo actual: ${cop(p.precioSugerido)}.` : ''}</p>
      <div class="tabla-contenedor"><table>
        <thead><tr><th>Fecha de entrada</th><th>Origen</th><th class="num">Entró</th><th class="num">Quedan</th><th class="num">Costo unitario</th></tr></thead>
        <tbody>${lotes.map((l) => `<tr class="${l.cantidadDisponible ? '' : 'inactivo'}"><td>${fechaCorta(l.fecha)}</td><td>${esc(l.origen)}</td><td class="num">${l.cantidadInicial}</td><td class="num">${l.cantidadDisponible}</td><td class="num">${cop(l.costoUnitario)}</td></tr>`).join('')
          || '<tr><td colspan="5" class="vacio">Sin lotes todavía. Registra una entrada de mercancía.</td></tr>'}</tbody>
      </table></div>
    </div>`;
  const acciones = {
    editar: () => formularioProducto(p, recargar),
    fotos: () => gestionarImagenes(p.id, recargar),
    ajustar: () => ajustarInventario(p, recargar),
    historial: () => historialPrecios(p),
    activo: () => intentar(async () => {
      await api(`/api/productos/${p.id}/activo`, { metodo: 'PUT', datos: { activo: !p.activo } });
      avisar(p.activo ? 'Producto desactivado (su historial se conserva)' : 'Producto activado');
      recargar();
    }),
    eliminar: () => {
      if (!confirm(`¿Eliminar definitivamente ${p.codigo} «${p.nombre}»? Solo se puede si nunca tuvo compras, ventas ni movimientos.`)) return;
      intentar(async () => {
        await api(`/api/productos/${p.id}`, { metodo: 'DELETE' });
        avisar('Producto eliminado');
        recargar();
      });
    },
  };
  $$('#detalle-producto [data-accion]').forEach((b) => b.addEventListener('click', acciones[b.dataset.accion]));
  $('#detalle-producto').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
      <label class="ancho">Fotos ${p?.imagenes.length ? `(ya tiene ${p.imagenes.length}; las nuevas se agregan)` : '(desde el celular puedes tomarla con la cámara)'}
        <input type="file" id="fotos-producto" accept="image/*" multiple></label>
      ${p ? '' : '<p class="ancho suave">Las existencias se cargan registrando una <strong>Entrada de mercancía</strong> (o un ajuste de inventario).</p>'}
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
        await api(`/api/productos/${guardado.id}/imagenes`, { metodo: 'POST', formulario: await formularioFotos(fotos) });
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
      <figcaption>${i === 0 ? '<span class="etiqueta">★ Principal</span>' : `<button class="pequeno" data-principal="${img}">★ Principal</button>`}
      <button class="pequeno peligro" data-borrar="${img}">Eliminar</button></figcaption></figure>`).join('')}</div>
    <form id="form-img" class="fila" style="margin-top:1em"><input type="file" name="archivos" accept="image/*" multiple required style="flex:1"><button class="primario">Subir</button></form>
    <div class="modal-pie"><button data-cerrar>Listo</button></div>`);
  m.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) recargar(); });
  $('#form-img', m).addEventListener('submit', (e) => {
    e.preventDefault();
    intentar(async () => {
      await api(`/api/productos/${id}/imagenes`, { metodo: 'POST', formulario: await formularioFotos(e.target.archivos.files) });
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

function ajustarInventario(p, recargar) {
  const m = abrirModal('Ajuste de existencias · ' + esc(p.nombre), `
    <form id="form-ajuste" class="campos">
      <fieldset class="opciones parejo ancho"><legend>Tipo de ajuste</legend>${pastillas('tipo', [['1', 'Entrada (sumar)'], ['-1', 'Salida (restar)']], '1')}</fieldset>
      <label>Cantidad <input type="number" name="cantidad" min="1" required></label>
      <label class="ancho">Motivo (opcional) <input name="motivo" placeholder="Conteo físico, regalo, daño…"></label>
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
      recargar();
    });
  });
}

const TIPOS_MOV = { COMPRA: 'Compra', VENTA: 'Venta', AJUSTE_ENTRADA: 'Ajuste +', AJUSTE_SALIDA: 'Ajuste −', ANULACION_VENTA: 'Anulación venta', ANULACION_COMPRA: 'Anulación compra' };

async function movimientos() {
  const lista = await api('/api/inventario/movimientos');
  $('#contenido-inventario').innerHTML = `<p class="suave" style="margin:0">Últimos 200 movimientos.</p><div class="tabla-contenedor"><table>
    <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th class="num">Cantidad</th><th>Documento</th><th>Motivo</th></tr></thead>
    <tbody>${lista.map((m) => `<tr><td>${fechaHora(m.fecha)}</td><td>${esc(m.productoNombre)}</td><td>${TIPOS_MOV[m.tipo]}</td>
      <td class="num"><span class="etiqueta ${m.cantidad > 0 ? 'ok' : 'neutra'}">${m.cantidad > 0 ? '+' : ''}${m.cantidad}</span></td>
      <td>${esc(m.referencia || '')}</td><td>${esc(m.motivo || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="vacio">Sin movimientos</td></tr>'}</tbody></table></div>`;
}

// =====================================================================
// ENTRADA DE MERCANCIA (compras)
// =====================================================================

function etiquetaVencimiento(fechaIso, saldo) {
  const hoy = hoyISO();
  const tres = new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-CA');
  const texto = fecha(fechaIso + 'T00:00');
  if (!saldo) return texto;
  if (fechaIso < hoy) return `<span class="etiqueta peligro">Vencida ${texto}</span>`;
  if (fechaIso <= tres) return `<span class="etiqueta bajo">${texto}</span>`;
  return texto;
}

function estadoCompra(c) {
  if (c.anulada) return '<span class="etiqueta neutra">Anulada</span>';
  if (!c.saldo) return '<span class="etiqueta ok">Pagada</span>';
  if (c.fechaVencimiento && c.fechaVencimiento < hoyISO()) return '<span class="etiqueta peligro">Vencido</span>';
  return '<span class="etiqueta bajo">Saldo pendiente</span>';
}

/** Compra anulada con "Corregir": su contenido llena el formulario al abrir la vista. */
let compraParaCorregir = null;

async function compras() {
  const [productosLista, numero] = await Promise.all([api('/api/productos?soloActivos=true'), api('/api/consecutivos/C')]);
  const base = compraParaCorregir;
  compraParaCorregir = null;
  vista().innerHTML = `
    <header class="cabecera">
      <div class="titulo-numero"><h1>Entrada de mercancía</h1><span class="etiqueta numero">${numero.numero}</span></div>
    </header>
    <div class="pagina-doble">
      <section class="tarjeta principal">
        ${productosLista.length ? '' : '<div class="aviso-caja">Primero crea tus productos en <a href="#inventario">Inventario</a>; luego registra aquí lo que llega.</div>'}
        ${base ? `<div class="aviso-caja">La compra ${base.numero} quedó anulada. Corrige lo que estaba mal y registra: quedará como compra nueva.
          ${base.pagado ? ` Ya le habías pagado ${cop(base.pagado)} al proveedor; ese valor aparece como pagado.` : ''}</div>` : ''}
        <form id="form-compra" style="display:flex;flex-direction:column;gap:20px">
          <div class="campos">
            <label>Fecha <input type="date" name="fecha" value="${base ? base.fecha : hoyISO()}"></label>
            <label>Proveedor (opcional, texto libre) <input name="proveedor" value="${esc(base?.proveedor)}" placeholder="Ej. Distribuidora Andina"></label>
          </div>
          <div>
            <h2 style="font-size:1.5rem">Productos recibidos</h2>
            <div class="lineas-compra" id="lineas"></div>
            <button type="button" class="contorno" id="agregar-linea" style="margin-top:8px">${icono('mas', 18)}Agregar producto</button>
          </div>
          <div>
            <h3>Costos adicionales</h3>
            <div class="campos">
              <label>Concepto <input name="notaCostosAdicionales" value="${esc(base?.notaCostosAdicionales)}" placeholder="Transporte"></label>
              <label>Valor <input type="number" min="0" name="costosAdicionales" value="${base?.costosAdicionales ?? 0}" data-numero></label>
            </div>
            <p class="suave" style="font-size:13px;margin:8px 0 0">Se registra por separado: no se reparte entre los productos.</p>
          </div>
          <div class="campos">
            <fieldset class="opciones"><legend>Método de pago</legend>${pastillas('metodoPago', [['EFECTIVO', 'Efectivo'], ['TRANSFERENCIA', 'Transferencia'], ['NEQUI', 'Nequi']], base?.pagos[0]?.metodo || 'EFECTIVO')}</fieldset>
            <fieldset class="opciones"><legend>Estado del pago</legend>${pastillas('estadoPago', [['PAGADA', 'Pagada'], ['PARCIAL', 'Pago parcial'], ['CREDITO', 'A crédito']], base ? (base.pagado >= base.total ? 'PAGADA' : base.pagado ? 'PARCIAL' : 'CREDITO') : 'PAGADA')}</fieldset>
          </div>
          <div class="campos" id="campos-saldo">
            <label id="campo-abono">Valor pagado ahora <input type="number" min="0" name="montoPagado" data-numero value="${base?.pagado ?? ''}"></label>
            <label>Vencimiento del saldo <input type="date" name="fechaVencimiento" value="${base?.fechaVencimiento || ''}"></label>
          </div>
          <label class="check"><input type="checkbox" name="actualizarPrecios"> Actualizar el precio de venta al sugerido con el nuevo costo</label>
          <div class="resumen">
            <div class="suave-fila"><span>Total mercancía</span><span id="r-total">$0</span></div>
            <div class="suave-fila"><span>Pagado ahora</span><span id="r-pagado">$0</span></div>
            <div class="total"><span>Saldo pendiente</span><span id="r-saldo">$0</span></div>
          </div>
          <button class="primario ancho-total" ${productosLista.length ? '' : 'disabled'}>Registrar compra</button>
        </form>
      </section>
      <aside class="lateral-derecho">
        <section class="tarjeta">
          <div class="fila" style="justify-content:space-between;margin-bottom:8px"><h2 style="margin:0">Compras recientes</h2>
            <label class="check" style="font-size:.85rem"><input type="checkbox" id="solo-pendientes"> Por pagar</label></div>
          <ul class="recientes" id="recientes"></ul>
        </section>
      </aside>
    </div>`;

  const form = $('#form-compra');
  const lineas = $('#lineas');
  const opciones = productosLista.map((p) => `<option value="${p.id}" data-costo="${p.costo}">${esc(p.nombre)} · ${esc(p.codigo)}</option>`).join('');
  const total = () => $$('.linea', lineas).reduce((s, l) => s + Number(l.querySelector('[name=cantidad]').value || 0) * Number(l.querySelector('[name=costo]').value || 0), 0);
  const estado = () => form.querySelector('[name=estadoPago]:checked').value;
  const refrescar = () => {
    $$('.linea', lineas).forEach((l) => {
      l.querySelector('.subtotal').textContent = cop(Number(l.querySelector('[name=cantidad]').value || 0) * Number(l.querySelector('[name=costo]').value || 0));
    });
    const t = total();
    const e = estado();
    $('#campos-saldo').hidden = e === 'PAGADA';
    $('#campo-abono').hidden = e !== 'PARCIAL';
    const pagado = e === 'PAGADA' ? t : e === 'CREDITO' ? 0 : Math.min(t, Number(form.montoPagado.value || 0));
    $('#r-total').textContent = cop(t);
    $('#r-pagado').textContent = cop(pagado);
    $('#r-saldo').textContent = cop(t - pagado);
    return { t, pagado };
  };
  const agregar = (previo = null) => {
    if (!productosLista.length) return;
    const linea = document.createElement('div');
    linea.className = 'linea';
    linea.innerHTML = `<label>Producto <select name="producto">${opciones}</select></label>
      <label>Cantidad <input type="number" name="cantidad" min="1" value="${previo?.cantidad ?? 1}"></label>
      <label>Costo unitario <input type="number" name="costo" min="0"></label>
      <div class="subtotal" aria-label="Subtotal">$0</div>
      <button type="button" class="icono peligro" aria-label="Quitar línea">✕</button>`;
    const sel = linea.querySelector('select');
    const costo = linea.querySelector('[name=costo]');
    const ponerCosto = () => { costo.value = sel.selectedOptions[0].dataset.costo; refrescar(); };
    sel.addEventListener('change', ponerCosto);
    linea.querySelector('button').addEventListener('click', () => { linea.remove(); refrescar(); });
    lineas.append(linea);
    if (previo) {
      sel.value = previo.productoId;
      costo.value = previo.costoUnitario;
      refrescar();
    } else {
      ponerCosto();
    }
  };
  $('#agregar-linea').addEventListener('click', () => agregar());
  form.addEventListener('input', refrescar);
  form.addEventListener('change', refrescar);
  if (base) base.items.filter((i) => productosLista.some((p) => p.id === i.productoId)).forEach((i) => agregar(i));
  if (!$$('.linea', lineas).length) agregar();
  refrescar();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const items = $$('.linea', lineas).map((l) => ({
      productoId: Number(l.querySelector('select').value),
      cantidad: Number(l.querySelector('[name=cantidad]').value),
      costoUnitario: Number(l.querySelector('[name=costo]').value),
    }));
    if (!items.length) return avisar('Agrega al menos un producto', 'error');
    const { pagado } = refrescar();
    intentar(async () => {
      const c = await api('/api/compras', { metodo: 'POST', datos: {
        fecha: form.fecha.value || null, proveedor: form.proveedor.value, items,
        costosAdicionales: Number(form.costosAdicionales.value || 0), notaCostosAdicionales: form.notaCostosAdicionales.value,
        montoPagado: pagado, metodoPago: form.querySelector('[name=metodoPago]:checked').value,
        fechaVencimiento: estado() === 'PAGADA' ? null : form.fechaVencimiento.value || null,
        actualizarPrecios: form.actualizarPrecios.checked,
      } });
      avisar(base ? `Compra corregida: ahora es la ${c.numero} (la ${base.numero} quedó anulada).`
        : `Compra ${c.numero} registrada. Inventario actualizado.`);
      compras();
    });
  });

  const cargarRecientes = () => intentar(async () => {
    const lista = (await api('/api/compras?pendientes=' + $('#solo-pendientes').checked)).slice(0, 30);
    $('#recientes').innerHTML = lista.map((c) => `<li data-id="${c.id}" tabindex="0">
      <div class="arriba"><span>${c.numero}${c.proveedor ? ' · ' + esc(c.proveedor) : ''}</span><span>${cop(c.total)}</span></div>
      <div class="abajo"><span>${fechaCorta(c.fecha + 'T00:00')}${c.saldo ? ' · saldo ' + cop(c.saldo) : ''}${c.saldo && c.fechaVencimiento ? ' · vence ' + fechaCorta(c.fechaVencimiento + 'T00:00') : ''}</span>${estadoCompra(c)}</div>
    </li>`).join('') || '<li class="vacio" style="cursor:default">No hay compras.</li>';
    $$('#recientes li[data-id]').forEach((li) => {
      li.addEventListener('click', () => verCompra(li.dataset.id, cargarRecientes));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') verCompra(li.dataset.id, cargarRecientes); });
    });
  });
  $('#solo-pendientes').addEventListener('change', cargarRecientes);
  cargarRecientes();
}

async function verCompra(id, recargar) {
  const c = await api('/api/compras/' + id);
  const m = abrirModal('Compra ' + c.numero, `
    <p>${fecha(c.fecha + 'T00:00')} · ${esc(c.proveedor || 'Sin proveedor')} ${estadoCompra(c)}</p>
    ${c.anulada ? `<div class="aviso-caja peligro" style="margin-bottom:1em">Anulada el ${fechaHora(c.fechaAnulacion)}. Motivo: ${esc(c.motivoAnulacion)}.
      Sus unidades salieron del inventario y ya no cuenta como deuda.${c.pagado ? ` Habías pagado ${cop(c.pagado)}: si corresponde, pide la devolución al proveedor o usa ese valor en la compra corregida.` : ''}</div>` : ''}
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
    <div class="modal-pie">
      ${c.anulada ? '' : `<button class="peligro" id="anular-compra">Anular compra</button>
        <button id="corregir-compra" title="Anula esta compra y abre el formulario lleno para corregirla">Corregir (anular y registrar de nuevo)</button>`}
      <button class="primario" data-cerrar>Cerrar</button></div>`);
  $('#form-abono', m)?.addEventListener('submit', (e) => {
    e.preventDefault();
    intentar(async () => {
      await api(`/api/compras/${id}/pagos`, { metodo: 'POST', datos: leerFormulario(e.target) });
      avisar('Pago registrado');
      recargar();
      verCompra(id, recargar);
    });
  });
  $('#anular-compra', m)?.addEventListener('click', () => anularCompra(c, recargar, false));
  $('#corregir-compra', m)?.addEventListener('click', () => anularCompra(c, recargar, true));
}

/** Pide el motivo, anula la compra y, si se pidio corregir, abre el formulario lleno. */
async function anularCompra(c, recargar, corregir) {
  const unidades = c.items.reduce((s, i) => s + i.cantidad, 0);
  const motivo = await pedirMotivo((corregir ? 'Corregir compra ' : 'Anular compra ') + c.numero,
    `Las <strong>${unidades} unidades</strong> de esta compra saldrán del inventario y dejará de contar como deuda con el proveedor.
     Solo se puede si ninguna de esas unidades se ha vendido.${corregir ? ' Después se abrirá el formulario con los mismos datos para que corrijas lo que estaba mal.' : ''}`,
    corregir ? 'Anular y corregir' : 'Anular compra', corregir ? 'Ej.: cantidad mal digitada' : 'Ej.: compra duplicada');
  if (!motivo) return;
  intentar(async () => {
    const anulada = await api(`/api/compras/${c.id}/anular`, { metodo: 'POST', datos: { motivo } });
    if (corregir) {
      compraParaCorregir = anulada;
      if (location.hash === '#compras') compras(); else location.hash = 'compras';
    } else {
      avisar(`Compra ${c.numero} anulada`);
      recargar();
      verCompra(c.id, recargar);
    }
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
// VENTAS (historial)
// =====================================================================

async function ventas() {
  vista().innerHTML = `
    <header class="cabecera">
      <div><h1>Ventas</h1><p class="sub">Historial, saldos y anulaciones</p></div>
      <div class="acciones"><a class="boton primario" href="#nueva-venta">${icono('mas', 18)}Nueva venta</a></div>
    </header>
    <div class="barra">
      <label style="flex:1 1 240px;max-width:360px">Buscar <input type="search" id="buscar-venta" placeholder="Número o cliente"></label>
      <label>Desde <input type="date" id="desde"></label>
      <label>Hasta <input type="date" id="hasta"></label>
      <label class="check" style="min-height:46px"><input type="checkbox" id="pendientes"> Solo con saldo (cuentas por cobrar)</label>
    </div>
    <div id="lista" style="display:flex;flex-direction:column;gap:12px"></div>`;
  const cargar = () => intentar(async () => {
    const params = new URLSearchParams({ pendientes: $('#pendientes').checked });
    if ($('#desde').value) params.set('desde', $('#desde').value);
    if ($('#hasta').value) params.set('hasta', $('#hasta').value);
    const texto = normalizar($('#buscar-venta').value.trim());
    const lista = (await api('/api/ventas?' + params)).filter((v) => !texto
      || normalizar(v.numero + ' ' + (v.pedidoNumero || '') + ' ' + (v.clienteNombre || 'cliente general')).includes(texto));
    const activas = lista.filter((v) => v.estado === 'ACTIVA');
    $('#lista').innerHTML = lista.length ? `
      <p class="suave" style="margin:0">${activas.length} venta(s) · Total ${cop(activas.reduce((s, v) => s + v.total, 0))} · Utilidad ${cop(activas.reduce((s, v) => s + v.utilidad, 0))} · Por cobrar ${cop(activas.reduce((s, v) => s + v.saldo, 0))}</p>
      <div class="tabla-contenedor"><table>
      <thead><tr><th>Número</th><th>Fecha</th><th>Cliente</th><th class="num">Total</th><th class="num">Utilidad</th><th class="num">Saldo</th><th>Estado</th></tr></thead>
      <tbody>${lista.map((v) => `<tr class="seleccionable ${v.estado === 'ANULADA' ? 'inactivo' : ''}" data-id="${v.id}" tabindex="0">
        <td><strong>${v.numero}</strong>${v.pedidoNumero ? ` <span class="suave">${v.pedidoNumero}</span>` : ''}</td>
        <td>${fechaHora(v.fechaHora)}</td><td>${esc(v.clienteNombre || 'Cliente general')}</td>
        <td class="num">${cop(v.total)}</td><td class="num">${cop(v.utilidad)}</td>
        <td class="num">${v.saldo ? cop(v.saldo) : '—'}${v.saldo && v.fechaVencimiento ? ' ' + etiquetaVencimiento(v.fechaVencimiento, v.saldo) : ''}</td>
        <td>${v.estado === 'ANULADA' ? '<span class="etiqueta neutra">Anulada</span>' : v.saldo ? '<span class="etiqueta bajo">Con saldo</span>' : '<span class="etiqueta ok">Pagada</span>'}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="tarjeta vacio">No hay ventas para mostrar.</div>';
    $$('#lista tr[data-id]').forEach((fila) => {
      fila.addEventListener('click', () => verVenta(fila.dataset.id, cargar));
      fila.addEventListener('keydown', (e) => { if (e.key === 'Enter') verVenta(fila.dataset.id, cargar); });
    });
  });
  ['desde', 'hasta', 'pendientes'].forEach((id) => $('#' + id).addEventListener('change', cargar));
  let espera;
  $('#buscar-venta').addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(cargar, 250); });
  await cargar();
}

// =====================================================================
// NUEVA VENTA (pagina de dos columnas, como el diseno)
// =====================================================================

async function nuevaVenta() {
  const [productosLista, clientesLista, numero] = await Promise.all([
    api('/api/productos?soloActivos=true'), api('/api/clientes'), api('/api/consecutivos/V')]);
  const carrito = [];
  hayCambiosSinGuardar = () => carrito.length > 0;
  const ahora = new Date();
  const etiquetaCliente = (c) => c.nombre + (c.telefono ? ' · ' + c.telefono : '');

  vista().innerHTML = `
    <header class="cabecera">
      <div class="titulo-numero"><h1>Nueva venta</h1><span class="etiqueta numero">${numero.numero}</span></div>
      <p class="suave" style="margin:0">${fechaCorta(ahora)} · ${ahora.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })} (se registra automáticamente)</p>
    </header>
    <div class="pagina-doble">
      <section class="tarjeta principal">
        <h2 style="margin:0">Productos</h2>
        <label>Buscar por nombre, código, categoría o marca
          <input id="buscar-prod" type="search" placeholder="Ej. labial, P-0003, Aurea" autocomplete="off"></label>
        <ul class="lista-productos" id="lista-productos"></ul>
      </section>
      <aside class="lateral-derecho">
        <section class="tarjeta" style="display:flex;flex-direction:column;gap:16px">
          <h2 style="margin:0">Venta actual</h2>
          <div>
            <label>Cliente (obligatorio si queda saldo)
              <input id="cliente" list="clientes-lista" placeholder="Cliente general (contado)" autocomplete="off"></label>
            <datalist id="clientes-lista">${clientesLista.map((c) => `<option value="${esc(etiquetaCliente(c))}"></option>`).join('')}</datalist>
            <div id="cliente-info" class="suave" style="font-size:13px;margin-top:6px"></div>
          </div>
          <ul class="lineas-venta" id="lineas"></ul>
          <div id="advertencias"></div>
          <div>
            <button type="button" class="pequeno" id="mostrar-descuento">Descuento a toda la venta</button>
            <div class="fila" id="descuento-global" hidden style="margin-top:8px">
              <select id="desc-tipo" style="width:90px"><option value="PORCENTAJE">%</option><option value="VALOR">$</option></select>
              <input type="number" id="desc-valor" min="0" value="0" style="flex:1" aria-label="Descuento a toda la venta">
            </div>
          </div>
          <div class="resumen">
            <div class="suave-fila"><span>Subtotal</span><span id="t-subtotal">$0</span></div>
            <div class="suave-fila"><span>Descuento</span><span id="t-descuento">$0</span></div>
            <div class="total"><span>Total a cobrar</span><span id="t-total">$0</span></div>
          </div>
          <fieldset class="opciones"><legend>Método de pago</legend>${pastillas('metodo', [['EFECTIVO', 'Efectivo'], ['NEQUI', 'Nequi'], ['TRANSFERENCIA', 'Transferencia']], 'EFECTIVO')}</fieldset>
          <fieldset class="opciones"><legend>Condición</legend>${pastillas('condicion', [['COMPLETO', 'Pago completo'], ['PARCIAL', 'Pago parcial'], ['CREDITO', 'A crédito']], 'COMPLETO')}</fieldset>
          <div class="campos" id="campos-credito" hidden>
            <label id="campo-pagado">Valor pagado ahora <input type="number" id="pagado" min="0"></label>
            <label>Vence <input type="date" id="vence"></label>
          </div>
          <label>Notas (opcional) <input id="notas"></label>
          <button type="button" class="primario ancho-total" id="confirmar-venta" style="min-height:52px">Confirmar venta</button>
        </section>
      </aside>
    </div>`;

  const descuentoDe = (tipo, valor, base) => !tipo || !valor ? 0 : Math.min(base, tipo === 'PORCENTAJE' ? Math.round(base * valor / 100) : valor);
  const condicion = () => $('[name=condicion]:checked').value;
  const clienteElegido = () => {
    const texto = $('#cliente').value.trim();
    return clientesLista.find((c) => etiquetaCliente(c) === texto || c.nombre.toLowerCase() === texto.toLowerCase()) || null;
  };

  const calcular = () => {
    let subtotal = 0;
    for (const l of carrito) {
      l.total = l.cantidad * l.precio - descuentoDe(l.descTipo, l.descValor, l.cantidad * l.precio);
      subtotal += l.total;
    }
    const desc = $('#descuento-global').hidden ? 0 : descuentoDe($('#desc-tipo').value, Number($('#desc-valor').value), subtotal);
    const total = subtotal - desc;
    $('#t-subtotal').textContent = cop(subtotal);
    $('#t-descuento').textContent = desc ? '−' + cop(desc) : '$0';
    $('#t-total').textContent = cop(total);

    const cond = condicion();
    $('#campos-credito').hidden = cond === 'COMPLETO';
    $('#campo-pagado').hidden = cond !== 'PARCIAL';
    const pagado = cond === 'COMPLETO' ? total : cond === 'CREDITO' ? 0 : Math.min(total, Number($('#pagado').value || 0));

    const cliente = clienteElegido();
    const texto = $('#cliente').value.trim();
    let info = '';
    if (texto && !cliente) info = `«${esc(texto)}» no está registrado. <button type="button" class="pequeno" id="crear-cliente">Crear cliente</button>`;
    else if (cliente) info = [cliente.saldo ? `Debe ${cop(cliente.saldo)}` : 'Sin saldo pendiente', cliente.limiteCredito ? `límite ${cop(cliente.limiteCredito)}` : ''].filter(Boolean).join(' · ');
    if (cond !== 'COMPLETO' && !cliente) info = (info ? info + '<br>' : '') + 'Para vender con saldo pendiente elige o crea un cliente.';
    $('#cliente-info').innerHTML = info;
    $('#crear-cliente')?.addEventListener('click', crearCliente);

    const bajoCosto = carrito.filter((l) => l.cantidad && l.total / l.cantidad < l.costo);
    $('#advertencias').innerHTML = bajoCosto.map((l) => `<div class="aviso-caja">${icono('alerta')}<span>${esc(l.nombre)} se vende a ${cop(l.total / l.cantidad)}, por debajo del costo (${cop(l.costo)}). Confirma antes de continuar.</span></div>`).join('');
    return { total, pagado, cliente };
  };

  const dibujarProductos = () => {
    const texto = normalizar($('#buscar-prod').value);
    const lista = productosLista.filter((p) => !texto || normalizar(`${p.nombre} ${p.codigo} ${p.marca} ${p.categoriaNombre || ''}`).includes(texto)).slice(0, 80);
    $('#lista-productos').innerHTML = lista.map((p) => {
      const enCarrito = carrito.find((l) => l.productoId === p.id)?.cantidad || 0;
      const quedan = p.disponible - enCarrito;
      return `<li>
        <img class="miniatura" src="${fotoProducto(p)}" alt="">
        <div class="texto"><strong>${esc(p.nombre)}</strong><span>${esc(p.codigo)} · ${esc(p.marca)} · ${p.disponible ? p.disponible + ' disponibles' : 'sin existencias'}</span></div>
        ${p.disponible ? `<span class="precio">${cop(p.precioVenta)}</span>` : '<span class="etiqueta agotado">Agotado</span>'}
        <button type="button" class="contorno pequeno" data-agregar="${p.id}" ${quedan > 0 ? '' : 'disabled'}>Agregar</button>
      </li>`;
    }).join('') || '<li class="vacio">No se encontraron productos.</li>';
  };

  const dibujarCarrito = () => {
    calcular();
    $('#lineas').innerHTML = carrito.map((l, i) => {
      const ajustado = l.precio !== l.precioLista || l.descValor;
      return `<li data-i="${i}">
        <div class="arriba"><span>${esc(l.nombre)}</span><span>${cop(l.total)}</span></div>
        <div class="abajo">
          <span class="stepper"><button type="button" data-menos aria-label="Quitar una unidad">−</button><output>${l.cantidad}</output><button type="button" class="mas" data-mas aria-label="Agregar una unidad">+</button></span>
          <button type="button" class="pequeno" data-ajustar>${ajustado ? 'Precio ajustado' : 'Ajustar precio'}</button>
          <span class="detalle">${ajustado ? `${cop(l.precio)} c/u · lista ${cop(l.precioLista)}` : cop(l.precio) + ' c/u'}</span>
        </div>
        <div class="ajuste-precio">
          <label>Precio c/u <input type="number" min="0" value="${l.precio}" data-campo="precio"></label>
          <label>Descuento <span class="fila" style="flex-wrap:nowrap"><select data-campo="descTipo" style="width:80px"><option value="">—</option><option value="PORCENTAJE" ${l.descTipo === 'PORCENTAJE' ? 'selected' : ''}>%</option><option value="VALOR" ${l.descTipo === 'VALOR' ? 'selected' : ''}>$</option></select>
            <input type="number" min="0" value="${l.descValor}" data-campo="descValor"></span></label>
          <button type="button" class="pequeno peligro" data-quitar style="align-self:flex-end">Quitar</button>
        </div>
      </li>`;
    }).join('') || '<li class="vacio" style="border:0">Agrega productos desde la lista.</li>';
    dibujarProductos();
  };

  async function crearCliente() {
    const nombre = $('#cliente').value.trim();
    const telefono = prompt(`Teléfono de ${nombre} (opcional)`) ?? '';
    intentar(async () => {
      const c = await api('/api/clientes', { metodo: 'POST', datos: { nombre, telefono } });
      clientesLista.push(c);
      $('#clientes-lista').insertAdjacentHTML('beforeend', `<option value="${esc(etiquetaCliente(c))}"></option>`);
      $('#cliente').value = etiquetaCliente(c);
      avisar(`Cliente ${c.nombre} creado`);
      calcular();
    });
  }

  $('#lista-productos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-agregar]');
    if (!b) return;
    const p = productosLista.find((x) => x.id === Number(b.dataset.agregar));
    const existente = carrito.find((l) => l.productoId === p.id);
    if (existente) existente.cantidad++;
    else carrito.push({ productoId: p.id, nombre: p.nombre, disponible: p.disponible, precioLista: p.precioVenta, costo: p.costo, cantidad: 1, precio: p.precioVenta, descTipo: '', descValor: 0, total: 0 });
    dibujarCarrito();
  });
  $('#lineas').addEventListener('click', (e) => {
    const fila = e.target.closest('[data-i]');
    if (!fila) return;
    const l = carrito[fila.dataset.i];
    if (e.target.closest('[data-mas]')) {
      if (l.cantidad < l.disponible) l.cantidad++; else avisar(`Solo hay ${l.disponible} de ${l.nombre}`, 'error');
    } else if (e.target.closest('[data-menos]')) {
      l.cantidad--;
      if (l.cantidad === 0) carrito.splice(fila.dataset.i, 1);
    } else if (e.target.closest('[data-quitar]')) {
      carrito.splice(fila.dataset.i, 1);
    } else if (e.target.closest('[data-ajustar]')) {
      fila.querySelector('.ajuste-precio').classList.toggle('abierto');
      return;
    } else {
      return;
    }
    dibujarCarrito();
  });
  $('#lineas').addEventListener('change', (e) => {
    const fila = e.target.closest('[data-i]');
    if (!fila || !e.target.dataset.campo) return;
    const l = carrito[fila.dataset.i];
    l[e.target.dataset.campo] = e.target.dataset.campo === 'descTipo' ? e.target.value : Number(e.target.value || 0);
    dibujarCarrito();
    $(`[data-i="${fila.dataset.i}"] .ajuste-precio`)?.classList.add('abierto');
  });
  let espera;
  $('#buscar-prod').addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(dibujarProductos, 120); });
  $('#mostrar-descuento').addEventListener('click', () => { $('#descuento-global').hidden = !$('#descuento-global').hidden; calcular(); });
  ['#desc-tipo', '#desc-valor', '#cliente', '#pagado'].forEach((s) => $(s).addEventListener('input', calcular));
  $$('[name=condicion]').forEach((r) => r.addEventListener('change', calcular));

  const enviar = async (confirmarAdvertencias) => {
    if (!carrito.length) return avisar('Agrega al menos un producto', 'error');
    const { total, pagado, cliente } = calcular();
    if ($('#cliente').value.trim() && !cliente) return avisar('Ese cliente no está registrado: créalo o deja el campo vacío', 'error');
    if (pagado < total && !cliente) return avisar('Para vender con saldo pendiente elige un cliente', 'error');
    const datos = {
      clienteId: cliente?.id ?? null,
      items: carrito.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, precioUnitario: l.precio, descuentoTipo: l.descTipo || null, descuentoValor: l.descValor || 0 })),
      descuentoTipo: $('#descuento-global').hidden ? null : $('#desc-tipo').value,
      descuentoValor: $('#descuento-global').hidden ? 0 : Number($('#desc-valor').value || 0),
      montoPagado: pagado,
      metodoPago: $('[name=metodo]:checked').value,
      fechaVencimiento: condicion() === 'COMPLETO' ? null : $('#vence').value || null,
      notas: $('#notas').value,
      confirmarAdvertencias,
    };
    const boton = $('#confirmar-venta');
    boton.disabled = true;
    try {
      const v = await api('/api/ventas', { metodo: 'POST', datos });
      carrito.length = 0;
      avisar(`Venta ${v.numero} registrada`);
      await nuevaVenta();
      verVenta(v.id);
    } catch (e) {
      boton.disabled = false;
      if (e.estado === 409 && e.advertencias) {
        if (confirm('Atención:\n\n• ' + e.advertencias.join('\n• ') + '\n\n¿Deseas confirmar la venta de todas formas?')) return enviar(true);
      } else {
        avisar(e.message, 'error');
      }
    }
  };
  $('#confirmar-venta').addEventListener('click', () => enviar(false));
  dibujarCarrito();
  $('#buscar-prod').focus();
}

async function verVenta(id, recargar) {
  const v = await api('/api/ventas/' + id);
  const anulada = v.estado === 'ANULADA';
  const m = abrirModal('Venta ' + v.numero, `
    <p>${fechaHora(v.fechaHora)} · ${esc(v.clienteNombre || 'Cliente general')} ${anulada ? '<span class="etiqueta neutra">Anulada</span>' : ''}</p>
    ${anulada ? `<div class="aviso-caja peligro" style="margin-bottom:1em">Anulada el ${fechaHora(v.fechaAnulacion)}. Motivo: ${esc(v.motivoAnulacion)}</div>` : ''}
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
      ${v.clienteTelefono ? `<a class="boton" target="_blank" rel="noopener" href="https://wa.me/${telWa(v.clienteTelefono)}?text=${encodeURIComponent(`Hola ${v.clienteNombre}, gracias por tu compra ${v.numero} en ${negocio.nombreNegocio} por ${cop(v.total)}.${v.saldo ? ' Saldo pendiente: ' + cop(v.saldo) + '.' : ''}`)}">WhatsApp</a>` : ''}
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
  $('#anular', m)?.addEventListener('click', async () => {
    const motivo = await pedirMotivo('Anular venta ' + v.numero,
      'Las unidades regresarán a sus lotes originales y la venta quedará marcada como anulada.', 'Anular venta', 'Ej.: el cliente devolvió el producto');
    if (!motivo) return;
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
    <header class="cabecera">
      <div><h1>Clientes</h1><p class="sub">Historial de compras, saldos y abonos</p></div>
      <div class="acciones"><button class="primario" id="btn-cliente">${icono('mas', 18)}Nuevo cliente</button></div>
    </header>
    <div class="barra">
      <label style="flex:1 1 280px;max-width:420px">Buscar <input type="search" id="buscar" placeholder="Nombre, teléfono o documento"></label>
      <label class="check" style="min-height:46px"><input type="checkbox" id="con-saldo"> Solo con deuda</label>
    </div>
    <div id="lista"></div>`;
  const cargar = () => intentar(async () => {
    let lista = await api('/api/clientes?q=' + encodeURIComponent($('#buscar').value));
    if ($('#con-saldo').checked) lista = lista.filter((c) => c.saldo > 0);
    $('#lista').innerHTML = lista.length ? `<div class="tabla-contenedor"><table>
      <thead><tr><th>Nombre</th><th>Teléfono</th><th>Documento</th><th class="num">Saldo</th><th>Última compra</th><th></th></tr></thead>
      <tbody>${lista.map((c) => `<tr><td><strong>${esc(c.nombre)}</strong></td><td>${esc(c.telefono || '')}</td><td>${esc(c.documento || '')}</td>
        <td class="num">${c.saldo ? `<span class="etiqueta bajo">${cop(c.saldo)}</span>` : '—'}</td><td>${fecha(c.ultimaCompra) || '—'}</td>
        <td class="fila"><button class="pequeno" data-ver="${c.id}">Ver</button> <button class="pequeno" data-editar="${c.id}">Editar</button></td></tr>`).join('')}</tbody></table></div>`
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
      <div class="indicador rosa"><span class="titulo">Saldo pendiente</span><span class="valor">${cop(c.saldo)}</span></div>
      <div class="indicador"><span class="titulo">Compras</span><span class="valor">${d.ventas.filter((v) => v.estado === 'ACTIVA').length}</span><span class="detalle">Última: ${fecha(c.ultimaCompra) || '—'}</span></div>
    </div>
    ${c.saldo ? `<h3 style="margin-top:1em">Registrar abono</h3><p class="suave">Se aplica a las deudas más antiguas primero.</p>${formularioAbono()}` : ''}
    <h3 style="margin-top:1em">Historial de compras</h3>
    <div class="tabla-contenedor"><table><thead><tr><th>Venta</th><th>Fecha</th><th class="num">Total</th><th class="num">Descuentos</th><th class="num">Saldo</th><th></th></tr></thead><tbody>
      ${d.ventas.map((v) => `<tr class="${v.estado === 'ANULADA' ? 'inactivo' : ''}"><td>${v.numero}${v.estado === 'ANULADA' ? ' (anulada)' : ''}</td><td>${fechaHora(v.fechaHora)}</td><td class="num">${cop(v.total)}</td>
        <td class="num">${cop(v.descuentoGlobal + v.items.reduce((s, i) => s + i.descuento, 0))}</td><td class="num">${v.saldo ? cop(v.saldo) : '—'}</td><td class="fila"><button class="pequeno" data-venta="${v.id}">Ver</button></td></tr>`).join('') || '<tr><td colspan="6" class="vacio">Sin compras</td></tr>'}
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
  PENDIENTE: ['Pendiente', 'bajo'], CONFIRMADO: ['Confirmado', 'ok'], EN_PREPARACION: ['En preparación', 'ok'],
  LISTO: ['Listo para entrega', 'ok'], ENTREGADO: ['Entregado', 'neutra'], CANCELADO: ['Cancelado', 'neutra'],
};
const SIGUIENTE = { PENDIENTE: 'CONFIRMADO', CONFIRMADO: 'EN_PREPARACION', EN_PREPARACION: 'LISTO', LISTO: 'ENTREGADO' };
const FORMAS_PAGO = { ANTICIPADO: 'Pago anticipado por transferencia o Nequi', CONTRA_ENTREGA: 'Paga al recibir o recoger' };

async function pedidos() {
  vista().innerHTML = `
    <header class="cabecera">
      <div><h1>Pedidos del catálogo</h1><p class="sub">Los pedidos pendientes reservan existencias. Al confirmar se crea la venta; al cancelar se liberan las unidades.</p></div>
    </header>
    <div class="chips" role="group" aria-label="Filtrar pedidos">
      <button type="button" class="chip" data-filtro="activos" aria-pressed="true">En curso</button>
      <button type="button" class="chip" data-filtro="PENDIENTE" aria-pressed="false">Pendientes</button>
      <button type="button" class="chip" data-filtro="todos" aria-pressed="false">Todos</button>
    </div>
    <div id="lista" class="lista-pedidos"></div>`;
  let filtro = 'activos';
  const cargar = () => intentar(async () => {
    const lista = (await api('/api/pedidos')).filter((p) => filtro === 'todos' || (filtro === 'activos' ? !['ENTREGADO', 'CANCELADO'].includes(p.estado) : p.estado === filtro));
    $('#lista').innerHTML = lista.map((p) => `<article class="tarjeta pedido-tarjeta">
      <div class="fila"><strong style="font-size:1.05rem">${p.numero}</strong><span class="espacio"></span><span class="etiqueta ${ESTADOS[p.estado][1]}">${ESTADOS[p.estado][0]}</span></div>
      <div class="suave">${fechaHora(p.fechaHora)}</div>
      <div><strong>${esc(p.nombreCliente)}</strong> · ${esc(p.telefono)}</div>
      <div>${p.tipoEntrega === 'DOMICILIO' ? 'Domicilio: ' + esc(p.direccion) : 'Recoge en tienda'}</div>
      ${p.formaPago ? `<div class="suave">${FORMAS_PAGO[p.formaPago]}</div>` : ''}
      <ul>${p.items.map((i) => `<li>${i.cantidad} × ${esc(i.productoNombre)} — ${cop(i.total)}</li>`).join('')}</ul>
      ${p.costoDomicilio ? `<div class="suave">Domicilio ${cop(p.costoDomicilio)}</div>` : ''}
      ${p.observaciones ? `<div class="suave">“${esc(p.observaciones)}”</div>` : ''}
      <div class="fila"><span class="cifra" style="font-size:1.6rem">${cop(p.total)}</span><span class="espacio"></span>${p.ventaNumero ? `<button class="pequeno" data-venta="${p.ventaId}">${p.ventaNumero}</button>` : ''}</div>
      <div class="fila">
        ${SIGUIENTE[p.estado] ? `<button class="primario pequeno" data-estado="${SIGUIENTE[p.estado]}" data-id="${p.id}">${p.estado === 'PENDIENTE' ? 'Confirmar' : 'Marcar: ' + ESTADOS[SIGUIENTE[p.estado]][0]}</button>` : ''}
        ${!['ENTREGADO', 'CANCELADO'].includes(p.estado) ? `<button class="pequeno peligro" data-estado="CANCELADO" data-id="${p.id}">Cancelar</button>` : ''}
        <a class="boton pequeno" target="_blank" rel="noopener" href="https://wa.me/${telWa(p.telefono)}?text=${encodeURIComponent(`Hola ${p.nombreCliente}, te escribimos de ${negocio.nombreNegocio} sobre tu pedido ${p.numero}.`)}">WhatsApp</a>
      </div></article>`).join('') || '<div class="tarjeta vacio">No hay pedidos.</div>';
    $$('[data-estado]').forEach((b) => b.addEventListener('click', () => cambiarEstadoPedido(lista.find((p) => p.id === Number(b.dataset.id)), b.dataset.estado, cargar)));
    $$('[data-venta]').forEach((b) => b.addEventListener('click', () => intentar(() => verVenta(b.dataset.venta, cargar))));
  });
  $$('[data-filtro]').forEach((b) => b.addEventListener('click', () => {
    filtro = b.dataset.filtro;
    $$('[data-filtro]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    cargar();
  }));
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
      const texto = `Hola ${p.nombreCliente}, ¡tu pedido ${p.numero} de ${negocio.nombreNegocio} fue confirmado! Total: ${cop(p.total)}. Coordinemos la fecha y hora de ${p.tipoEntrega === 'DOMICILIO' ? 'entrega' : 'recogida'}.`;
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
    <header class="cabecera"><div><h1>Configuración</h1><p class="sub">Datos del negocio, catálogo, metas y recibos</p></div></header>
    <form id="form-config" style="display:flex;flex-direction:column;gap:20px">
      <section class="tarjeta"><h2>Datos del negocio</h2><div class="campos">
        ${campo('nombreNegocio', 'Nombre comercial')}${campo('telefono', 'Teléfono', 'tel')}
        ${campo('whatsapp', 'WhatsApp que recibe pedidos', 'tel', 'placeholder="3001234567"')}${campo('correo', 'Correo', 'email')}
        ${campo('direccion', 'Dirección')}${campo('horarios', 'Horarios de atención', 'text', 'placeholder="Lun a Sáb 9:00 a.m. – 7:00 p.m."')}
        ${campo('instagram', 'Instagram (enlace)', 'url')}${campo('facebook', 'Facebook (enlace)', 'url')}${campo('tiktok', 'TikTok (enlace)', 'url')}
      </div></section>
      <section class="tarjeta"><h2>Metas mensuales</h2><div class="campos">
        <label>Meta de ventas del mes <input name="metaVentasMes" type="number" min="0" step="1000" data-numero value="${c.metaVentasMes || ''}" placeholder="Ej. 12000000"></label>
        <label>Meta de utilidad del mes <input name="metaUtilidadMes" type="number" min="0" step="1000" data-numero value="${c.metaUtilidadMes || ''}" placeholder="Ej. 6000000"></label>
      </div><p class="suave" style="margin:10px 0 0">El panel principal muestra el avance. Déjalas vacías si no quieres usar metas.</p></section>
      <section class="tarjeta"><h2>Precios y entregas</h2><div class="campos">
        <label>Incremento sobre el costo (%) <input name="porcentajeIncremento" type="number" min="0" data-numero value="${c.porcentajeIncremento}"></label>
        <label>Costo fijo del domicilio <input name="costoDomicilio" type="number" min="0" data-numero value="${c.costoDomicilio}"></label>
      </div><p class="suave" style="margin:10px 0 0">100 % = el precio sugerido es el doble del costo. Se redondea al millar más cercano.</p></section>
      <section class="tarjeta"><h2>Catálogo digital</h2>
        <div class="fila">${check('catalogoHabilitado', 'Catálogo habilitado')}${check('mostrarAgotados', 'Mostrar productos agotados con etiqueta «Agotado» (si no, se ocultan)')}</div>
        <div class="fila" style="margin-top:1em;align-items:flex-start;gap:20px">
          <div id="qr"></div>
          <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:12px">
            <p style="margin:0">Enlace público: <a href="${urlCatalogo}" target="_blank" rel="noopener">${urlCatalogo}</a></p>
            <div class="fila"><button type="button" id="copiar">Copiar enlace</button>
              <a class="boton" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('Mira el catálogo de ' + (c.nombreNegocio || negocio.nombreNegocio) + ': ' + urlCatalogo)}">Compartir por WhatsApp</a>
              <a class="boton" id="descargar-qr" download="catalogo-vivanta-qr.png">Descargar QR</a></div>
          </div>
        </div>
      </section>
      <section class="tarjeta"><h2>Recibos</h2>
        <div class="fila">${check('reciboMostrarLogo', 'Logo')}${check('reciboMostrarDireccion', 'Dirección')}${check('reciboMostrarTelefono', 'Teléfono')}${check('reciboMostrarCliente', 'Datos del cliente')}</div>
        <label style="margin-top:.8em">Notas al pie del recibo <textarea name="notasRecibo">${esc(c.notasRecibo)}</textarea></label>
      </section>
      <div class="fila fin"><button class="primario">Guardar configuración</button></div>
    </form>
    <section class="tarjeta"><h2>Logo</h2>
      <p class="suave">El logo de Vivanta Colección ya viene incluido en la app, el catálogo y los recibos. Sube otro solo si quieres reemplazarlo.</p>
      <img class="logo" src="${c.tieneLogo ? '/api/public/logo?' + Date.now() : '/img/logo-vivanta.png'}" alt="Logo actual" style="max-height:90px;max-width:240px;margin-bottom:1em">
      <form id="form-logo" class="fila"><input type="file" name="archivo" accept="image/*" required style="flex:1"><button>Subir otro logo</button></form>
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
      const datos = leerFormulario(e.target);
      datos.metaVentasMes = datos.metaVentasMes ?? 0;
      datos.metaUtilidadMes = datos.metaUtilidadMes ?? 0;
      negocio = await api('/api/configuracion', { metodo: 'PUT', datos: { ...datos, tieneLogo: c.tieneLogo } });
      avisar('Configuración guardada');
    });
  });
  $('#form-logo').addEventListener('submit', (e) => {
    e.preventDefault();
    intentar(async () => {
      // El logo se sube tal cual para conservar su fondo transparente.
      await api('/api/configuracion/logo', { metodo: 'POST', formulario: new FormData(e.target) });
      avisar('Logo actualizado');
      configuracion();
    });
  });
}

// ---------- Inicio ----------
api('/api/configuracion').then((c) => { negocio = c; }).catch(() => {});
navegar();
