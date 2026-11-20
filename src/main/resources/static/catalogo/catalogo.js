// =====================================================================
// Catalogo publico de Vivanta Coleccion
// Dos pantallas: la lista de productos (#) y "Tu pedido" (#pedido).
// El pedido se envia por WhatsApp y queda registrado como "pendiente".
// El esqueleto fijo (encabezado, buscador, menu, barra, WhatsApp) esta en
// index.html; aqui se llenan las partes que dependen de los datos.
// =====================================================================

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const cop = (n) => '$' + Math.round(n || 0).toLocaleString('es-CO');
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const telWa = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.length === 10 ? '57' + d : d; };
const normalizar = (t) => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const foto = (p) => p.imagenes.length ? `/api/public/imagenes/${p.imagenes[0]}` : '/img/isotipo-vivanta.png';
const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Enlace seguro para las redes: solo http o https. Si la duena escribio "instagram.com/vivanta"
 * sin "https://", se lo agregamos. Cualquier otra cosa (por ejemplo "javascript:") se descarta.
 */
function urlSegura(texto) {
  let t = String(texto || '').trim();
  if (!t) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t) && /^[\w-]+(\.[\w-]+)+/.test(t)) t = 'https://' + t;
  try {
    const url = new URL(t);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
}
/** Foto de una promocion: una ruta de este mismo sitio ("/api/...") o una direccion http(s). */
const fotoSegura = (u) => /^\/(?!\/)/.test(String(u || '')) ? u : urlSegura(u);

let catalogo = null;
let busqueda = '';
/**
 * Filtros de "Nuestro catálogo". Categorias y marcas pueden ser varias a la vez (Set = lista sin repetidos).
 * min/max = rango de precio en pesos (null = sin limite). orden = como se ordena la grilla.
 */
const filtros = {
  categorias: new Set(), marcas: new Set(), min: null, max: null,
  disponibles: false, ofertas: false, sets: false, orden: 'recomendados',
};
let carrito = cargarCarrito();                        // { productoId: cantidad }
let datosCliente = cargar('vivanta-cliente', {});     // nombre, telefono, direccion, entrega, formaPago...

function cargar(clave, inicial) {
  try {
    const dato = JSON.parse(localStorage.getItem(clave));
    // Solo se acepta un objeto normal; cualquier otra cosa guardada se ignora.
    return dato && typeof dato === 'object' && !Array.isArray(dato) ? dato : inicial;
  } catch { return inicial; }
}
/** El pedido guardado: solo ids numericos y cantidades enteras positivas (lo demas se descarta). */
function cargarCarrito() {
  const limpio = {};
  for (const [id, cantidad] of Object.entries(cargar('vivanta-carrito', {}))) {
    if (/^\d+$/.test(id) && Number.isInteger(cantidad) && cantidad > 0) limpio[id] = cantidad;
  }
  return limpio;
}
function guardar() {
  try {
    localStorage.setItem('vivanta-carrito', JSON.stringify(carrito));
    localStorage.setItem('vivanta-cliente', JSON.stringify(datosCliente));
  } catch { /* sin almacenamiento: el pedido vive solo en esta pagina */ }
}

function avisar(texto, tipo = '') {
  const caja = document.createElement('div');
  caja.className = 'aviso ' + tipo;
  caja.textContent = texto;
  $('#avisos').append(caja);
  setTimeout(() => caja.remove(), 4000);
}

const producto = (id) => catalogo.productos.find((p) => p.id === Number(id));
const lineas = () => Object.entries(carrito).map(([id, cantidad]) => ({ p: producto(id), cantidad })).filter((l) => l.p);

async function iniciar() {
  try {
    catalogo = await (await fetch('/api/public/catalogo')).json();
  } catch {
    $('#principal').innerHTML = '<p class="no-results">No pudimos cargar el catálogo. Intenta de nuevo en un momento.</p>';
    return;
  }
  catalogo.productos.forEach((p) => { p.imagenes = p.imagenes || []; });
  const n = catalogo.negocio;
  document.title = 'Catálogo · ' + n.nombreNegocio;
  // El encabezado siempre usa el logo blanco; el logo subido por la duena va solo en el menu.
  if (n.tieneLogo) $('#menu-logo').src = '/api/public/logo';
  if (n.envioGratisDesde > 0) {
    $('#anuncio').innerHTML = `<span class="spark">✦</span><span>Envío gratis en compras desde</span><strong>${cop(n.envioGratisDesde)}</strong><span class="spark">✦</span>`;
    $('#anuncio').hidden = false;
  }
  dibujarPie(n);
  dibujarMenu(n);
  prepararBuscador();
  prepararFiltros();
  prepararWhatsapp(n);
  prepararAparicion();

  // Quita del pedido productos que ya no existen.
  for (const id of Object.keys(carrito)) if (!producto(id)) delete carrito[id];
  window.addEventListener('hashchange', mostrar);
  mostrar();
}

function mostrar() {
  abrirMarcas(false);
  if ($('#filtros').classList.contains('abierto')) abrirFiltros(false);
  $('#waFloat').hidden = !catalogo.negocio.whatsapp;
  if (!catalogo.habilitado) return mantenimiento();
  const enPedido = location.hash === '#pedido' && lineas().length > 0;
  $('#cabeza').classList.toggle('compacta', enPedido);
  // En "Tu pedido" no se busca ni se muestra el boton flotante (ya hay un boton de WhatsApp).
  $('#buscador').hidden = enPedido;
  if (enPedido) $('#waFloat').hidden = true;
  if (enPedido) pantallaPedido();
  else pantallaProductos();
  window.scrollTo(0, 0);
}

/** Muestra u oculta la barra "Ver pedido"; el body avisa al CSS para subir el boton de WhatsApp. */
function mostrarBarra(si) {
  $('#barra-pedido').hidden = !si;
  document.body.classList.toggle('con-barra', si);
}

function mantenimiento() {
  const n = catalogo.negocio;
  mostrarBarra(false);
  $('#buscador').hidden = true;
  $('#principal').innerHTML = `<div class="contenedor"><div class="tarjeta mantenimiento">
    <h1 style="font-size:2rem;margin:0">Catálogo en mantenimiento</h1>
    <p style="margin:0">Estamos actualizando nuestros productos. Escríbenos y con gusto te atendemos.</p>
    ${n.horarios ? `<p style="margin:0"><strong>Horarios:</strong> ${esc(n.horarios)}</p>` : ''}
    ${n.whatsapp ? `<a class="boton primario" target="_blank" rel="noopener" href="https://wa.me/${telWa(n.whatsapp)}">Escribir por WhatsApp</a>` : ''}
  </div></div>`;
}

const FRASE = 'Un universo de belleza por descubrir.';
const OFERTAS = '__ofertas__';
const SETS = '__sets__';
/** Enlace de WhatsApp con un mensaje ya escrito (para "Información de compra" y el boton flotante). */
const enlaceWhatsapp = (n, texto) => n.whatsapp ? `https://wa.me/${telWa(n.whatsapp)}?text=${encodeURIComponent(texto)}` : '';
const categoriasDelCatalogo = () => [...new Set(catalogo.productos.map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
const marcasDelCatalogo = () => [...new Set(catalogo.productos.map((p) => p.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

// ---------- Pie y menu lateral ----------

/** Pie color vino: nombre, frase, datos, redes con sus logos, enlaces y derechos. */
function dibujarPie(n) {
  const red = (icono, nombre, url) => url && `<a class="social-item" href="${esc(url)}" target="_blank" rel="noopener">
      <span class="social-icon supplied-logo"><img src="/img/redes/${icono}.png" alt=""></span><span>${nombre}</span></a>`;
  const redes = [
    n.whatsapp && red('whatsapp', 'WhatsApp', 'https://wa.me/' + telWa(n.whatsapp)),
    red('instagram', 'Instagram', urlSegura(n.instagram)),
    red('facebook', 'Facebook', urlSegura(n.facebook)),
    red('tiktok', 'TikTok', urlSegura(n.tiktok)),
  ].filter(Boolean);
  $('#pie').innerHTML = `
    <div class="footer-logo">${esc(n.nombreNegocio.replace(/\s+Colecci[oó]n$/i, ''))}</div>
    <p>${FRASE}</p>
    ${n.horarios || n.direccion || n.telefono ? `<p class="pie-datos">${[n.horarios, n.direccion, n.telefono && 'Tel. ' + n.telefono].filter(Boolean).map(esc).join('<br>')}</p>` : ''}
    <section class="social-section" id="contactos" aria-label="Redes sociales">
      <h2>Síguenos en nuestras redes sociales</h2>
      <div class="social-grid" style="--columnas:${redes.length + 1}">
        ${redes.join('')}
        <button class="social-item share-button" type="button" id="compartir"><span class="social-icon supplied-logo"><img src="/img/redes/compartir.png" alt=""></span><span>Compartir</span></button>
      </div>
    </section>
    <div class="footer-links">
      <button type="button" data-ir-politica="terminos">Información de compra</button>
      <button type="button" data-ir-politica="">Políticas</button>
      <button type="button" data-ir-contactos>Contactos</button>
    </div>
    <div class="copyright">© ${new Date().getFullYear()} ${esc(n.nombreNegocio)}. Todos los derechos reservados.</div>`;
  // Compartir: el menu del telefono; si no existe, copiar el enlace; si tampoco, abrir WhatsApp.
  $('#compartir').addEventListener('click', async () => {
    const datos = { title: n.nombreNegocio, text: FRASE, url: location.origin + '/catalogo/' };
    try {
      if (navigator.share) await navigator.share(datos);
      else { await navigator.clipboard.writeText(datos.url); avisar('Enlace del catálogo copiado'); }
    } catch (e) {
      if (e.name !== 'AbortError') window.open('https://wa.me/?text=' + encodeURIComponent('Mira el catálogo de ' + n.nombreNegocio + ': ' + datos.url), '_blank', 'noopener');
    }
  });
}

/** Abre o cierra el menu lateral. */
function abrirMenu(si) {
  $('#menu').classList.toggle('abierto', si);
  $('#menu-sombra').hidden = !si;
  $('#abrir-menu').setAttribute('aria-expanded', String(si));
  if (si) { abrirMarcas(false); $('#cerrar-menu').focus(); }
}

/** Menu lateral: categorias, ofertas y sets; despues informacion de compra y contactos. */
function dibujarMenu(n) {
  const boton = (dato, texto) => `<button type="button" data-ir-cat="${esc(dato)}">${esc(texto)}</button>`;
  $('#menu-contenido').innerHTML = `
    <nav aria-label="Categorías">
      ${boton('', 'Todos los productos')}
      ${catalogo.productos.some((p) => p.precioAntes) ? boton(OFERTAS, 'Ofertas') : ''}
      ${catalogo.productos.some((p) => p.combo) ? boton(SETS, 'Sets') : ''}
      ${categoriasDelCatalogo().map((c) => boton(c, c)).join('')}
    </nav>
    <div class="drawer-separator"></div>
    <nav aria-label="Información">
      <button type="button" class="drawer-special" data-ir-politica="terminos">Información de compra</button>
      <button type="button" class="drawer-special" data-ir-politica="">Políticas</button>
      <button type="button" class="drawer-special" data-ir-contactos>Contactos</button>
    </nav>`;
  $('#abrir-menu').addEventListener('click', () => abrirMenu(true));
  $('#cerrar-menu').addEventListener('click', () => abrirMenu(false));
  $('#menu-sombra').addEventListener('click', () => abrirMenu(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { abrirMenu(false); abrirMarcas(false); } });
}

/** Filtra por categoria y baja hasta los productos. "Todos los productos" quita todos los filtros. */
function irACategoria(cat) {
  if (!cat) limpiarFiltros(true);
  else {
    // Desde el menu se mira UNA categoria (o Ofertas o Sets); la marca y la busqueda se conservan.
    filtros.categorias.clear();
    filtros.ofertas = cat === OFERTAS;
    filtros.sets = cat === SETS;
    if (cat !== OFERTAS && cat !== SETS) filtros.categorias.add(cat);
  }
  const bajar = () => $('#productos')?.scrollIntoView({ block: 'start' });
  if (location.hash === '#pedido') { location.hash = ''; setTimeout(bajar, 80); return; }
  // Si ya estamos viendo los productos, basta con volver a dibujar la grilla.
  if ($('#grilla')) dibujarGrilla(); else pantallaProductos();
  requestAnimationFrame(bajar);
}

// ---------- Buscador con las marcas ----------

/** Abre o cierra el panel de marcas bajo el buscador (solo si hay mas de una marca). */
function abrirMarcas(si) {
  $('#buscador').classList.toggle('open', si && !$('#marcas').hidden);
}

/** Pinta las marcas elegidas en las baldosas. */
function marcarMarcas() {
  $$('.brand-tile').forEach((b) => {
    const activa = filtros.marcas.has(b.dataset.marca);
    b.classList.toggle('active', activa);
    b.setAttribute('aria-pressed', String(activa));
  });
}

/** Baldosas de marcas, sacadas de los productos reales. Con una sola marca no hace falta el filtro. */
function dibujarMarcas() {
  const marcas = marcasDelCatalogo();
  $('#marcas').hidden = marcas.length < 2;
  $('#marcas').innerHTML = marcas.map((m) => {
    const activa = filtros.marcas.has(m);
    return `<button type="button" class="brand-tile ${activa ? 'active' : ''}" data-marca="${esc(m)}" aria-pressed="${activa}">${esc(m)}</button>`;
  }).join('');
}

/** Baja suavemente hasta "Nuestro catálogo" (sin animacion si la persona la desactivo). */
const bajarAProductos = () => $('#productos')?.scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth', block: 'start' });

function prepararBuscador() {
  const barra = $('#buscador');
  const entrada = $('#buscar');
  entrada.addEventListener('input', () => { busqueda = entrada.value; dibujarGrilla(); });
  entrada.addEventListener('focus', () => abrirMarcas(true));
  entrada.addEventListener('click', () => abrirMarcas(true));
  // Con "Buscar" en el teclado del celular se cierra el teclado y se ven los resultados.
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); entrada.blur(); abrirMarcas(false); bajarAProductos(); }
  });
  // Tocar fuera del buscador cierra el panel de marcas.
  document.addEventListener('click', (e) => { if (!barra.contains(e.target)) abrirMarcas(false); });
  // Elegir una marca la suma al filtro; tocar otra vez la misma la quita.
  $('#marcas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-marca]');
    if (!b) return;
    const m = b.dataset.marca;
    if (filtros.marcas.has(m)) filtros.marcas.delete(m); else filtros.marcas.add(m);
    marcarMarcas();
    abrirMarcas(false);
    entrada.blur();
    dibujarGrilla();
    if (filtros.marcas.has(m)) bajarAProductos();
  });
}

// ---------- Pantalla 1: productos ----------

function pantallaProductos() {
  const promos = catalogo.promociones || [];
  const ofertas = catalogo.productos.filter((p) => p.precioAntes && p.disponible > 0);
  dibujarMarcas();
  $('#principal').innerHTML = `
    ${promos.length ? `<section class="carousel-section" aria-label="Promociones destacadas">
      <div class="carousel-window" id="carrusel">
        ${promos.map((p) => {
          const enlazada = p.productoId && producto(p.productoId);
          const imagen = fotoSegura(p.imagenUrl);
          return `<article class="promo" ${enlazada ? `data-producto="${esc(p.productoId)}" tabindex="0"` : ''}>
          <div class="promo-visual">${imagen ? `<img src="${esc(imagen)}" alt="" loading="lazy">` : '<span aria-hidden="true">✦</span>'}</div>
          <div class="promo-copy">${p.marca ? `<div class="promo-brand">${esc(p.marca)}</div>` : ''}<h3>${esc(p.titulo)}</h3>${p.texto ? `<p>${esc(p.texto)}</p>` : ''}
            ${enlazada ? '<span class="ver">Ver producto</span>' : ''}</div>
        </article>`;
        }).join('')}
      </div>
      ${promos.length > 1 ? `<div class="dots">${promos.map((_, i) => `<button type="button" data-punto="${i}" aria-label="Promoción ${i + 1}" aria-current="${i === 0}"></button>`).join('')}</div>` : ''}
    </section>` : ''}
    ${ofertas.length ? `<section class="real-promos" id="promociones">
      <div class="real-section-heading"><div><h2>Promociones y ofertas vigentes</h2><p>Encuentra tus favoritos a un precio especial.</p></div></div>
      <div class="real-promo-grid">${ofertas.map(tarjetaOferta).join('')}</div>
    </section>` : ''}
    <section class="real-catalog" id="productos">
      <div class="real-section-heading">
        <div><h2>Nuestro catálogo</h2><p>Descubre todos nuestros productos.</p></div>
        <div class="heading-tools">
          <button type="button" class="filtrar-btn" id="abrir-filtros" aria-haspopup="dialog" aria-controls="filtros">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>
            Filtrar y ordenar<span class="filtros-cuenta" id="filtros-cuenta" hidden></span>
          </button>
          <span id="productCount"></span>
          <button type="button" class="clear-filters" id="limpiar" hidden>Limpiar filtros</button>
        </div>
      </div>
      <div class="filtro-activo" id="filtro-activo" aria-live="polite"></div>
      <div class="real-product-grid" id="grilla"></div>
      <p class="no-results" id="sin-resultados" hidden>No encontramos productos con esos filtros.</p>
    </section>`;
  $('#limpiar').addEventListener('click', () => { limpiarFiltros(true); dibujarGrilla(); });
  $('#abrir-filtros').addEventListener('click', () => abrirFiltros(true));
  activarCarrusel();
  dibujarGrilla();
  actualizarBarra();
}

/** El carrusel pasa solo cada 6 segundos; se puede deslizar con el dedo o tocar los puntos. */
let temporizadorCarrusel = null;
function activarCarrusel() {
  clearInterval(temporizadorCarrusel);
  const ventana = $('#carrusel');
  if (!ventana || ventana.children.length < 2) return;
  const total = ventana.children.length;
  const actual = () => Math.round(ventana.scrollLeft / ventana.clientWidth);
  const ir = (i) => ventana.scrollTo({ left: ((i + total) % total) * ventana.clientWidth });
  ventana.addEventListener('scroll', () => {
    $$('[data-punto]').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.punto) === actual())));
  }, { passive: true });
  $$('[data-punto]').forEach((b) => b.addEventListener('click', () => { ir(Number(b.dataset.punto)); reiniciar(); }));
  const reiniciar = () => {
    clearInterval(temporizadorCarrusel);
    if (sinMovimiento()) return;
    temporizadorCarrusel = setInterval(() => { if (document.contains(ventana)) ir(actual() + 1); else clearInterval(temporizadorCarrusel); }, 6000);
  };
  ventana.addEventListener('pointerdown', reiniciar);
  reiniciar();
}

const descuento = (p) => Math.round((1 - p.precio / p.precioAntes) * 100);
const fechaLarga = (d) => new Date(d + 'T00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
/** Precio tachado: el normal si hay oferta; en un set sin oferta, lo que costaria por separado. */
const tachado = (p) => p.precioAntes || (p.combo && p.precioSeparado > p.precio ? p.precioSeparado : 0);

/** Precio de la tarjeta: con oferta o set, el precio anterior tachado y lo que se ahorra. */
function precioHtml(p) {
  const antes = tachado(p);
  if (!antes) return `<p class="price">${cop(p.precio)}</p>`;
  return `<p class="price">${cop(p.precio)} <s class="antes">${cop(antes)}</s></p>
      ${p.precioAntes && p.ofertaHasta ? `<p class="vigencia">Hasta el ${esc(fechaLarga(p.ofertaHasta))}</p>`
        : !p.precioAntes ? `<p class="vigencia">Ahorras ${cop(antes - p.precio)}</p>` : ''}`;
}

/** Botones de compra: "No disponible", "Agregar" o el − n + si ya esta en el pedido. */
function accionesHtml(p) {
  const enPedido = carrito[p.id] || 0;
  if (p.disponible <= 0) return '<button type="button" disabled>No disponible</button>';
  if (enPedido) return `<div class="stepper"><button type="button" data-menos="${esc(p.id)}" aria-label="Quitar una unidad">−</button><output>${enPedido}</output><button type="button" class="mas" data-mas="${esc(p.id)}" aria-label="Agregar una unidad">+</button></div>`;
  return `<button type="button" class="contorno" data-mas="${esc(p.id)}">Agregar</button>`;
}

/** Foto que abre el detalle del producto. */
const fotoBoton = (p, etiqueta = '') => `<button type="button" class="foto-btn ${p.imagenes.length ? 'con-foto' : ''}" data-detalle="${esc(p.id)}" aria-label="Ver ${esc(p.nombre)}">
        <img src="${esc(foto(p))}" alt="" loading="lazy" class="${p.imagenes.length ? '' : 'sin-foto'}">${etiqueta}</button>`;

/** Tarjeta de "Promociones y ofertas vigentes". */
function tarjetaOferta(p) {
  return `<article class="real-promo-card ${p.disponible <= 0 ? 'agotado' : ''}">
      ${fotoBoton(p)}
      <div class="real-promo-body">
        <span class="real-discount">${descuento(p)}% OFF</span>
        <h3>${esc(p.nombre)}</h3><p class="maker">${esc(p.marca)}</p>
        <div class="real-prices"><span class="real-now">${cop(p.precio)}</span><span class="real-before">${cop(p.precioAntes)}</span></div>
        ${p.ofertaHasta ? `<p class="vigencia">Hasta el ${esc(fechaLarga(p.ofertaHasta))}</p>` : ''}
        <div class="acciones" data-acciones="${esc(p.id)}">${accionesHtml(p)}</div>
      </div>
    </article>`;
}

/** Tarjeta de "Nuestro catálogo". */
function tarjetaProducto(p) {
  const agotado = p.disponible <= 0;
  return `<article class="real-product-card ${agotado ? 'agotado' : ''}">
      ${fotoBoton(p, agotado ? '<span class="etiqueta agotado">Agotado</span>' : '')}
      ${p.categoria ? `<p class="category">${esc(p.categoria)}</p>` : ''}
      ${p.combo || (p.precioAntes && !agotado) ? `<div class="pastillas">${p.combo ? '<span class="pastilla-set">Set</span>' : ''}${p.precioAntes && !agotado ? `<span class="pastilla-oferta">Oferta −${descuento(p)} %</span>` : ''}</div>` : ''}
      <h3>${esc(p.nombre)}</h3>
      ${p.combo ? `<p class="incluye">Incluye: ${esc(p.incluye)}</p>` : `<p class="maker">${esc(p.marca)}</p>`}
      ${precioHtml(p)}
      <div class="acciones" data-acciones="${esc(p.id)}">${accionesHtml(p)}</div>
    </article>`;
}

// ---------- Filtros del catálogo ----------

const ORDENES = {
  recomendados: 'Recomendados',
  'precio-asc': 'Precio: menor a mayor',
  'precio-desc': 'Precio: mayor a menor',
  descuento: 'Mayor descuento',
  nombre: 'Nombre: A a Z',
};
/** Rangos rapidos de precio: [minimo, maximo] (null = sin limite). */
const RANGOS = [[null, 30000], [30000, 60000], [60000, 100000], [100000, null]];
const textoRango = (min, max) => min == null ? `Hasta ${cop(max)}` : max == null ? `Más de ${cop(min)}` : `${cop(min)} – ${cop(max)}`;
/** Porcentaje que se ahorra: por oferta, o en un set frente a comprar por separado. */
const ahorro = (p) => {
  const antes = tachado(p);
  return antes > p.precio ? (antes - p.precio) / antes : 0;
};
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Cuantos filtros hay puestos (sin contar la busqueda ni el orden): el numerito del boton. */
const filtrosPuestos = () => filtros.categorias.size + filtros.marcas.size
  + (filtros.min != null || filtros.max != null ? 1 : 0) + filtros.disponibles + filtros.ofertas + filtros.sets;

/** Quita todos los filtros (y la busqueda si se pide). El orden vuelve a "Recomendados". */
function limpiarFiltros(tambienBusqueda) {
  filtros.categorias.clear();
  filtros.marcas.clear();
  filtros.min = filtros.max = null;
  filtros.disponibles = filtros.ofertas = filtros.sets = false;
  filtros.orden = 'recomendados';
  if (tambienBusqueda) { busqueda = ''; $('#buscar').value = ''; }
  marcarMarcas();
  if ($('#filtros').classList.contains('abierto')) dibujarPanelFiltros();
}

/** Productos que cumplen la busqueda y todos los filtros, ya ordenados. */
function productosFiltrados() {
  const texto = normalizar(busqueda.trim());
  const { categorias, marcas, min, max } = filtros;
  const lista = catalogo.productos.filter((p) => (!categorias.size || categorias.has(p.categoria))
    && (!marcas.size || marcas.has(p.marca))
    && (min == null || p.precio >= min) && (max == null || p.precio <= max)
    && (!filtros.disponibles || p.disponible > 0)
    && (!filtros.ofertas || p.precioAntes)
    && (!filtros.sets || p.combo)
    && normalizar(`${p.nombre} ${p.marca || ''} ${p.categoria || ''}`).includes(texto));
  const comparar = {
    'precio-asc': (a, b) => a.precio - b.precio,
    'precio-desc': (a, b) => b.precio - a.precio,
    descuento: (a, b) => ahorro(b) - ahorro(a),
    nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
  }[filtros.orden];
  // Siempre primero lo que se puede comprar; los agotados al final. Dentro de cada grupo, el orden elegido.
  return lista.sort((a, b) => ((b.disponible > 0) - (a.disponible > 0)) || (comparar ? comparar(a, b) : 0));
}

/** Etiquetas de los filtros puestos, cada una con su × para quitarla. */
function etiquetasFiltros() {
  const chip = (dato, texto) => `<button type="button" class="chip-filtro" data-quitar="${esc(dato)}" aria-label="Quitar filtro ${esc(texto)}">${esc(texto)}<span aria-hidden="true">×</span></button>`;
  return [
    busqueda.trim() && chip('busqueda', `“${busqueda.trim()}”`),
    ...[...filtros.categorias].map((c) => chip('cat:' + c, c)),
    ...[...filtros.marcas].map((m) => chip('marca:' + m, m)),
    (filtros.min != null || filtros.max != null) && chip('precio', textoRango(filtros.min, filtros.max)),
    filtros.disponibles && chip('disponibles', 'Solo disponibles'),
    filtros.ofertas && chip('ofertas', 'En oferta'),
    filtros.sets && chip('sets', 'Sets'),
  ].filter(Boolean).join('');
}

/** Dibuja "Nuestro catálogo" con la busqueda, los filtros y el orden que esten puestos. */
function dibujarGrilla() {
  if (!$('#grilla')) return;
  const lista = productosFiltrados();
  const puestos = filtrosPuestos();
  $('#filtro-activo').innerHTML = etiquetasFiltros();
  $('#limpiar').hidden = !(puestos || busqueda.trim() || filtros.orden !== 'recomendados');
  $('#filtros-cuenta').hidden = !puestos;
  $('#filtros-cuenta').textContent = puestos;
  $('#grilla').innerHTML = lista.map(tarjetaProducto).join('');
  $('#productCount').textContent = plural(lista.length, 'producto', 'productos');
  $('#sin-resultados').hidden = lista.length > 0;
  const ver = $('#ver-resultados');
  if (ver) ver.textContent = lista.length ? `Ver ${plural(lista.length, 'producto', 'productos')}` : 'Sin resultados';
}

/** Quita un filtro desde su etiqueta (la × de la fila "Mostrando"). */
function quitarFiltro(dato) {
  if (dato === 'busqueda') { busqueda = ''; $('#buscar').value = ''; }
  else if (dato === 'precio') filtros.min = filtros.max = null;
  else if (dato.startsWith('cat:')) filtros.categorias.delete(dato.slice(4));
  else if (dato.startsWith('marca:')) filtros.marcas.delete(dato.slice(6));
  else filtros[dato] = false;   // disponibles, ofertas o sets
  marcarMarcas();
  dibujarGrilla();
}

/** Panel lateral "Filtrar y ordenar". Se arma cada vez que se abre, con lo que este puesto. */
function dibujarPanelFiltros() {
  const productos = catalogo.productos;
  const cuantos = (campo, valor) => productos.filter((p) => p[campo] === valor).length;
  const casilla = (nombre, valor, texto, marcada, cuenta) => `<label class="filtro-opcion">
      <input type="checkbox" name="${nombre}" value="${esc(valor)}" ${marcada ? 'checked' : ''}>
      <span>${esc(texto)}</span>${cuenta != null ? `<span class="filtro-n">${cuenta}</span>` : ''}</label>`;
  const hayOfertas = productos.some((p) => p.precioAntes);
  const haySets = productos.some((p) => p.combo);
  const categorias = categoriasDelCatalogo();
  const marcas = marcasDelCatalogo();
  $('#filtros').innerHTML = `
    <div class="filtros-cabeza">
      <h2 id="filtros-titulo">Filtrar y ordenar</h2>
      <button type="button" class="filtros-cerrar" data-cerrar-filtros aria-label="Cerrar">×</button>
    </div>
    <form class="filtros-cuerpo" id="form-filtros" novalidate>
      <fieldset class="filtro-grupo">
        <legend>Ordenar por</legend>
        ${Object.entries(ORDENES).map(([valor, texto]) => `<label class="filtro-opcion">
          <input type="radio" name="orden" value="${valor}" ${filtros.orden === valor ? 'checked' : ''}><span>${texto}</span></label>`).join('')}
      </fieldset>
      <fieldset class="filtro-grupo">
        <legend>Precio</legend>
        <div class="filtro-rango">
          <label>Mínimo<input type="number" name="min" inputmode="numeric" min="0" step="1000" placeholder="$ 0" value="${filtros.min ?? ''}"></label>
          <label>Máximo<input type="number" name="max" inputmode="numeric" min="0" step="1000" placeholder="Sin límite" value="${filtros.max ?? ''}"></label>
        </div>
        <div class="filtro-chips">
          ${RANGOS.map(([min, max]) => {
            const activo = filtros.min === min && filtros.max === max;
            return `<button type="button" class="${activo ? 'activo' : ''}" data-rango="${min ?? ''}-${max ?? ''}" aria-pressed="${activo}">${textoRango(min, max)}</button>`;
          }).join('')}
        </div>
      </fieldset>
      <fieldset class="filtro-grupo">
        <legend>Mostrar</legend>
        ${casilla('disponibles', '1', 'Solo disponibles', filtros.disponibles, productos.filter((p) => p.disponible > 0).length)}
        ${hayOfertas ? casilla('ofertas', '1', 'En oferta', filtros.ofertas, productos.filter((p) => p.precioAntes).length) : ''}
        ${haySets ? casilla('sets', '1', 'Sets', filtros.sets, productos.filter((p) => p.combo).length) : ''}
      </fieldset>
      ${categorias.length > 1 ? `<fieldset class="filtro-grupo">
        <legend>Categoría</legend>
        ${categorias.map((c) => casilla('categoria', c, c, filtros.categorias.has(c), cuantos('categoria', c))).join('')}
      </fieldset>` : ''}
      ${marcas.length > 1 ? `<fieldset class="filtro-grupo">
        <legend>Marca</legend>
        ${marcas.map((m) => casilla('marca', m, m, filtros.marcas.has(m), cuantos('marca', m))).join('')}
      </fieldset>` : ''}
    </form>
    <div class="filtros-pie">
      <button type="button" class="contorno" data-limpiar-filtros>Limpiar</button>
      <button type="button" class="primario" id="ver-resultados" data-cerrar-filtros></button>
    </div>`;
  dibujarGrilla();   // pone el numero en "Ver N productos"
}

/** Lee el panel y aplica lo elegido al momento (sin boton "Aplicar"). */
function leerPanelFiltros() {
  const form = $('#form-filtros');
  const marcadas = (nombre) => new Set($$(`input[name="${nombre}"]:checked`, form).map((i) => i.value));
  const numero = (nombre) => {
    const v = form.elements[nombre].value.trim();
    const n = Math.floor(Number(v));
    return v === '' || !Number.isFinite(n) || n < 0 ? null : n;
  };
  filtros.orden = form.elements.orden.value || 'recomendados';
  filtros.categorias = marcadas('categoria');
  filtros.marcas = marcadas('marca');
  filtros.min = numero('min');
  filtros.max = numero('max');
  // Si los escribieron al reves (minimo mayor que maximo), se intercambian.
  if (filtros.min != null && filtros.max != null && filtros.min > filtros.max) [filtros.min, filtros.max] = [filtros.max, filtros.min];
  filtros.disponibles = Boolean(form.elements.disponibles?.checked);
  filtros.ofertas = Boolean(form.elements.ofertas?.checked);
  filtros.sets = Boolean(form.elements.sets?.checked);
  $$('[data-rango]', $('#filtros')).forEach((b) => {
    const activo = b.dataset.rango === `${filtros.min ?? ''}-${filtros.max ?? ''}`;
    b.classList.toggle('activo', activo);
    b.setAttribute('aria-pressed', String(activo));
  });
  marcarMarcas();
  dibujarGrilla();
}

let focoAntesDeFiltros = null;
function abrirFiltros(si) {
  const panel = $('#filtros');
  if (si) {
    focoAntesDeFiltros = document.activeElement;
    dibujarPanelFiltros();
    abrirMarcas(false);
  }
  panel.classList.toggle('abierto', si);
  $('#filtros-sombra').hidden = !si;
  document.body.classList.toggle('modal-abierto', si);
  $('#abrir-filtros')?.setAttribute('aria-expanded', String(si));
  if (si) panel.querySelector('.filtros-cerrar').focus();
  else if (focoAntesDeFiltros?.isConnected) focoAntesDeFiltros.focus();
}

function prepararFiltros() {
  const panel = $('#filtros');
  let espera;
  panel.addEventListener('change', (e) => { if (e.target.closest('#form-filtros')) leerPanelFiltros(); });
  // Los precios se aplican cuando se deja de escribir un momento.
  panel.addEventListener('input', (e) => {
    if (e.target.type !== 'number') return;
    clearTimeout(espera);
    espera = setTimeout(leerPanelFiltros, 400);
  });
  panel.addEventListener('submit', (e) => e.preventDefault());
  panel.addEventListener('click', (e) => {
    const rango = e.target.closest('[data-rango]');
    if (rango) {
      const form = $('#form-filtros');
      const yaEstaba = rango.classList.contains('activo');
      const [min, max] = rango.dataset.rango.split('-');
      form.elements.min.value = yaEstaba ? '' : min;
      form.elements.max.value = yaEstaba ? '' : max;
      leerPanelFiltros();
    }
    if (e.target.closest('[data-limpiar-filtros]')) { limpiarFiltros(false); dibujarPanelFiltros(); }
    if (e.target.closest('[data-cerrar-filtros]')) {
      const ver = e.target.closest('#ver-resultados');
      abrirFiltros(false);
      if (ver) bajarAProductos();
    }
  });
  $('#filtros-sombra').addEventListener('click', () => abrirFiltros(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('abierto')) abrirFiltros(false); });
  // Las × de las etiquetas de filtros.
  document.addEventListener('click', (e) => {
    const quitar = e.target.closest('[data-quitar]');
    if (quitar) quitarFiltro(quitar.dataset.quitar);
  });
}

/**
 * Despues de + o −, solo se cambian los botones de ese producto (en ofertas y en el catalogo):
 * asi la pagina no salta ni las tarjetas vuelven a aparecer. Si el boton tenia el foco, se conserva.
 */
function actualizarAcciones(id) {
  const p = producto(id);
  const activo = document.activeElement;
  $$(`[data-acciones="${Number(id)}"]`).forEach((caja) => {
    const teniaFoco = caja.contains(activo);
    const eraMenos = teniaFoco && activo.hasAttribute('data-menos');
    caja.innerHTML = accionesHtml(p);
    if (teniaFoco) (caja.querySelector(eraMenos ? '[data-menos]' : '[data-mas]') || caja.querySelector('button'))?.focus();
  });
}

function actualizarBarra() {
  const ls = lineas();
  const unidades = ls.reduce((s, l) => s + l.cantidad, 0);
  mostrarBarra(unidades > 0 && location.hash !== '#pedido');
  $('#barra-cuenta').textContent = `Ver pedido · ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}`;
  const total = ls.reduce((s, l) => s + l.cantidad * l.p.precio, 0);
  $('#barra-total').textContent = cop(total);
  const { costoDomicilio, envioGratisDesde } = catalogo.negocio;
  $('#barra-nota').textContent = 'Pedidos por WhatsApp' + (envioGratisDesde > 0 && total >= envioGratisDesde ? ' · Domicilio gratis'
    : envioGratisDesde > 0 ? ` · Te faltan ${cop(envioGratisDesde - total)} para domicilio gratis`
      : costoDomicilio ? ' · Domicilio ' + cop(costoDomicilio) : '');
}

function cambiarCantidad(id, delta) {
  const p = producto(id);
  if (!p) return;
  const nueva = (carrito[id] || 0) + delta;
  if (nueva > p.disponible) {
    avisar(p.disponible === 1 ? 'Solo hay 1 unidad disponible' : 'Solo hay ' + p.disponible + ' unidades disponibles', 'error');
    return;
  }
  if (nueva <= 0) delete carrito[id];
  else carrito[id] = nueva;
  guardar();
  if (location.hash === '#pedido') {
    if (lineas().length) pantallaPedido(); else location.hash = '';
  } else {
    actualizarAcciones(id);
    actualizarBarra();
  }
}

// Un solo "oyente" para los botones que se dibujan una y otra vez.
document.addEventListener('click', (e) => {
  const mas = e.target.closest('[data-mas]');
  const menos = e.target.closest('[data-menos]');
  const detalle = e.target.closest('[data-detalle]') || e.target.closest('.promo[data-producto]');
  const cat = e.target.closest('[data-ir-cat]');
  const contactos = e.target.closest('[data-ir-contactos]');
  const politica = e.target.closest('[data-ir-politica]');
  if (mas) cambiarCantidad(mas.dataset.mas, 1);
  if (menos) cambiarCantidad(menos.dataset.menos, -1);
  if (detalle) verDetalle(producto(detalle.dataset.detalle || detalle.dataset.producto));
  // Categorias y "Contactos" funcionan igual desde el menu o el pie.
  if (cat) { abrirMenu(false); irACategoria(cat.dataset.irCat); }
  if (contactos) { abrirMenu(false); $('#contactos').scrollIntoView({ block: 'start' }); }
  if (politica) { abrirMenu(false); verPolitica(politica.dataset.irPolitica); }
});

/** Abre una politica (o solo baja a la seccion si no se dice cual) y la muestra en pantalla. */
function verPolitica(id) {
  const detalle = id && $('#politica-' + id);
  if (detalle) detalle.open = true;
  (detalle || $('#politicas')).scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth', block: 'start' });
}
// Las promociones del carrusel tambien se abren con Enter desde el teclado.
document.addEventListener('keydown', (e) => {
  const promo = e.target.closest?.('.promo[data-producto]');
  if (promo && e.key === 'Enter') verDetalle(producto(promo.dataset.producto));
});

/**
 * Detalle del producto: foto a la izquierda y datos a la derecha (en el celular, uno debajo del otro).
 * En un set se listan los productos que incluye, cada uno con su foto.
 */
function verDetalle(p) {
  if (!p) return;
  const fotos = p.imagenes.length ? p.imagenes.map((i) => `/api/public/imagenes/${i}`) : [foto(p)];
  const antes = tachado(p);
  const porcentaje = antes ? Math.round((1 - p.precio / antes) * 100) : 0;
  const quedan = p.disponible - (carrito[p.id] || 0);
  let cantidad = 1;
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `<div class="modal detalle-producto" role="dialog" aria-modal="true" aria-label="${esc(p.nombre)}">
    <button type="button" class="icono cerrar-detalle" data-cerrar aria-label="Cerrar">✕</button>
    <div class="detalle-grid">
      <div class="detalle-galeria">
        <div class="foto-grande ${p.imagenes.length ? 'con-foto' : ''}">
          <img id="foto-grande" src="${esc(fotos[0])}" alt="${esc(p.nombre)}" class="${p.imagenes.length ? '' : 'sin-foto'}">
          ${porcentaje > 0 ? `<span class="insignia-descuento">−${porcentaje} %</span>` : ''}
        </div>
        ${fotos.length > 1 ? `<div class="miniaturas">${fotos.map((f, i) => `<button type="button" data-foto="${i}" aria-label="Foto ${i + 1}" aria-pressed="${i === 0}"><img src="${esc(f)}" alt=""></button>`).join('')}</div>` : ''}
      </div>
      <div class="detalle-info">
        ${p.combo ? '<span class="pastilla-set">Set</span>' : p.categoria ? `<span class="categoria-prod">${esc(p.categoria)}</span>` : ''}
        <h2 class="detalle-nombre">${esc(p.nombre)}</h2>
        <p class="suave" style="margin:0">${esc(p.marca)}${p.combo && p.categoria ? ' · ' + esc(p.categoria) : ''}</p>
        <p class="detalle-precio">${antes ? `<s class="antes">${cop(antes)}</s>` : ''}<span>${cop(p.precio)}</span></p>
        ${p.precioAntes ? `<p class="vigencia" style="margin:0">Oferta −${descuento(p)} %${p.ofertaHasta ? ' · hasta el ' + esc(fechaLarga(p.ofertaHasta)) : ''}</p>`
          : p.combo && antes ? `<p class="vigencia" style="margin:0">Ahorras ${cop(antes - p.precio)} comprando el set</p>` : ''}
        ${p.combo && p.productosDelSet?.length ? `<div class="incluye-set"><h3>Este set incluye</h3><ul>${p.productosDelSet.map((c) => `<li>
            <img src="${c.imagenId ? '/api/public/imagenes/' + esc(c.imagenId) : '/img/isotipo-vivanta.png'}" alt="" loading="lazy">
            <div><strong>${c.cantidad > 1 ? esc(c.cantidad) + ' × ' : ''}${esc(c.nombre)}</strong><span>Precio suelto ${cop(c.precio)}</span></div></li>`).join('')}</ul></div>` : ''}
        ${p.descripcion ? `<p class="detalle-descripcion">${esc(p.descripcion)}</p>` : ''}
        ${quedan > 0 ? `<div class="detalle-compra">
            <span class="suave">Cantidad</span>
            <div class="stepper"><button type="button" id="det-menos" aria-label="Quitar una unidad">−</button><output id="det-cantidad">1</output><button type="button" class="mas" id="det-mas" aria-label="Agregar una unidad">+</button></div>
            <button type="button" class="primario agregar-detalle" id="det-agregar">Agregar al pedido</button>
          </div>`
          : `<p style="margin:0"><span class="etiqueta agotado">${p.disponible > 0 ? 'Ya tienes en tu pedido todas las unidades disponibles' : 'Agotado'}</span></p>`}
      </div>
    </div>
  </div>`;
  // Cerrar: con la X, tocando fuera de la ventana o con Escape.
  const conEscape = (e) => { if (e.key === 'Escape') cerrar(); };
  const cerrar = () => {
    fondo.remove();
    document.body.classList.remove('modal-abierto');
    document.removeEventListener('keydown', conEscape);
  };
  document.addEventListener('keydown', conEscape);
  fondo.addEventListener('click', (e) => {
    if (e.target === fondo || e.target.closest('[data-cerrar]')) cerrar();
    const miniatura = e.target.closest('[data-foto]');
    if (miniatura) {
      $('#foto-grande', fondo).src = fotos[miniatura.dataset.foto];
      $$('[data-foto]', fondo).forEach((b) => b.setAttribute('aria-pressed', String(b === miniatura)));
    }
  });
  if (quedan > 0) {
    const mostrarCantidad = () => { $('#det-cantidad', fondo).textContent = cantidad; };
    $('#det-menos', fondo).addEventListener('click', () => { cantidad = Math.max(1, cantidad - 1); mostrarCantidad(); });
    $('#det-mas', fondo).addEventListener('click', () => {
      if (cantidad >= quedan) { avisar(p.disponible === 1 ? 'Solo hay 1 unidad disponible' : 'Solo hay ' + p.disponible + ' unidades disponibles', 'error'); return; }
      cantidad += 1; mostrarCantidad();
    });
    $('#det-agregar', fondo).addEventListener('click', () => {
      cambiarCantidad(p.id, cantidad);
      avisar(cantidad + (cantidad === 1 ? ' unidad agregada' : ' unidades agregadas') + ' a tu pedido');
      cerrar();
    });
  }
  document.body.append(fondo);
  document.body.classList.add('modal-abierto');
  $('[data-cerrar]', fondo).focus();
}

// ---------- Pantalla 2: tu pedido ----------

function pantallaPedido() {
  const n = catalogo.negocio;
  const ls = lineas();
  const entrega = datosCliente.entrega || 'RECOGIDA';
  const formaPago = datosCliente.formaPago || 'ANTICIPADO';
  const subtotal = ls.reduce((s, l) => s + l.cantidad * l.p.precio, 0);
  const gratis = n.envioGratisDesde > 0 && subtotal >= n.envioGratisDesde;
  const faltan = n.envioGratisDesde > 0 && !gratis ? n.envioGratisDesde - subtotal : 0;
  const domicilio = entrega === 'DOMICILIO' && !gratis ? n.costoDomicilio : 0;
  const opcion = (nombre, valor, texto, elegida) => `<label class="opcion"><input type="radio" name="${nombre}" value="${valor}" ${valor === elegida ? 'checked' : ''}>${texto}</label>`;
  mostrarBarra(false);
  $('#principal').innerHTML = `
    <form class="pedido" id="form-pedido">
      <header>
        <a class="volver" href="#">← Seguir comprando</a>
        <h1>Tu pedido</h1>
      </header>
      <section class="tarjeta" style="padding:0">
        <ul class="items">${ls.map(({ p, cantidad }) => `<li>
          <img src="${esc(foto(p))}" alt="">
          <div class="texto"><strong>${esc(p.nombre)}</strong><span>${cantidad} × ${cop(p.precio)}</span>
            <div class="quitar"><button type="button" data-menos="${esc(p.id)}" aria-label="Quitar una unidad">−</button><button type="button" data-mas="${esc(p.id)}" aria-label="Agregar una unidad">+</button></div></div>
          <strong>${cop(cantidad * p.precio)}</strong>
        </li>`).join('')}</ul>
      </section>
      <fieldset class="opciones"><legend>¿Cómo lo recibes?</legend>
        ${opcion('entrega', 'RECOGIDA', 'Recoger', entrega)}
        ${opcion('entrega', 'DOMICILIO', 'Domicilio' + (gratis ? ' (gratis)' : n.costoDomicilio ? ' (' + cop(n.costoDomicilio) + ')' : ''), entrega)}
      </fieldset>
      ${gratis ? '<p class="nota" style="margin-top:-8px">¡Tu pedido tiene domicilio gratis!</p>'
        : faltan ? `<p class="nota" style="margin-top:-8px">Te faltan <strong>${cop(faltan)}</strong> para tener domicilio gratis.</p>` : ''}
      <div style="display:flex;flex-direction:column;gap:12px">
        <label>Nombre <input name="nombre" required value="${esc(datosCliente.nombre)}" autocomplete="name"></label>
        <label>Teléfono <input name="telefono" type="tel" required value="${esc(datosCliente.telefono)}" placeholder="Ej. 300 000 0000" autocomplete="tel"></label>
        ${entrega === 'DOMICILIO' ? `<label>Dirección (obligatoria para domicilio) <input name="direccion" required value="${esc(datosCliente.direccion)}" placeholder="Calle, número, barrio" autocomplete="street-address"></label>` : ''}
        <label>Observaciones (opcional) <textarea name="observaciones" rows="3" placeholder="Tono, referencia, horario preferido…">${esc(datosCliente.observaciones)}</textarea></label>
      </div>
      <fieldset class="opciones columna"><legend>Forma de pago</legend>
        ${opcion('formaPago', 'ANTICIPADO', 'Pago anticipado por transferencia o Nequi', formaPago)}
        ${opcion('formaPago', 'CONTRA_ENTREGA', 'Pagar al recibir o recoger', formaPago)}
      </fieldset>
      <section class="tarjeta resumen-pedido">
        <div><span class="suave">Subtotal</span><span>${cop(subtotal)}</span></div>
        ${domicilio ? `<div><span class="suave">Domicilio</span><span>${cop(domicilio)}</span></div>`
          : entrega === 'DOMICILIO' && gratis ? '<div><span class="suave">Domicilio</span><span>Gratis</span></div>' : ''}
        <div class="total"><span style="font-weight:600">Total</span><span>${cop(subtotal + domicilio)}</span></div>
      </section>
      ${n.whatsapp
        ? `<p class="autorizacion">Al enviar tu pedido aceptas los <button type="button" class="enlace" data-ir-politica="terminos">Términos y condiciones</button> y autorizas el tratamiento de tus datos según la <button type="button" class="enlace" data-ir-politica="privacidad">Política de privacidad</button>.</p>
          <button class="primario whatsapp" id="enviar">Enviar pedido por WhatsApp</button>`
        : '<div class="aviso-caja peligro">Por ahora no podemos recibir pedidos en línea. Vuelve pronto.</div>'}
      <p class="nota">No necesitas crear una cuenta. La fecha y hora de entrega o recogida se coordinan por WhatsApp cuando confirmemos tu pedido.</p>
    </form>`;
  const form = $('#form-pedido');
  form.addEventListener('input', () => {
    datosCliente = { ...datosCliente, nombre: form.nombre.value, telefono: form.telefono.value, direccion: form.direccion?.value ?? datosCliente.direccion, observaciones: form.observaciones.value };
    guardar();
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'entrega' || e.target.name === 'formaPago') {
      datosCliente[e.target.name] = e.target.value;
      guardar();
      if (e.target.name === 'entrega') pantallaPedido();
    }
  });
  form.addEventListener('submit', enviarPedido);
}

async function enviarPedido(e) {
  e.preventDefault();
  const form = e.target;
  const boton = $('#enviar');
  // Se abre la ventana antes de esperar al servidor para que el navegador no la bloquee.
  const ventana = window.open('', '_blank');
  boton.disabled = true;
  boton.textContent = 'Enviando…';
  try {
    const r = await fetch('/api/public/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: form.nombre.value, telefono: form.telefono.value,
        tipoEntrega: datosCliente.entrega || 'RECOGIDA',
        formaPago: datosCliente.formaPago || 'ANTICIPADO',
        direccion: form.direccion?.value || null,
        observaciones: form.observaciones.value || null,
        items: lineas().map((l) => ({ productoId: l.p.id, cantidad: l.cantidad })),
      }),
    });
    const respuesta = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(respuesta.mensaje || 'No se pudo enviar el pedido');
    if (ventana) ventana.location = respuesta.whatsappUrl;
    else location.href = respuesta.whatsappUrl;
    carrito = {};
    datosCliente.observaciones = '';
    guardar();
    $('#principal').innerHTML = `<div class="pedido"><section class="tarjeta" style="text-align:center;display:flex;flex-direction:column;gap:10px">
      <h1>¡Pedido ${esc(respuesta.numero)} enviado!</h1>
      <p style="margin:0">Total ${cop(respuesta.total)}. Si WhatsApp no se abrió, <a href="${esc(respuesta.whatsappUrl)}" target="_blank" rel="noopener">toca aquí</a>.</p>
      <p class="suave" style="margin:0">Te confirmaremos por WhatsApp.</p>
      <a class="boton contorno" href="#">Volver al catálogo</a>
    </section></div>`;
    // Recarga existencias para el siguiente pedido
    catalogo.productos = (await (await fetch('/api/public/catalogo')).json()).productos;
    catalogo.productos.forEach((p) => { p.imagenes = p.imagenes || []; });
  } catch (error) {
    if (ventana) ventana.close();
    avisar(error.message, 'error');
    boton.disabled = false;
    boton.textContent = 'Enviar pedido por WhatsApp';
  }
}

// ---------- Boton flotante de WhatsApp ----------

/**
 * Boton que se puede arrastrar con el dedo: al soltarlo se pega al costado mas cercano.
 * Un toque sin arrastrar abre WhatsApp con un mensaje ya escrito.
 */
function prepararWhatsapp(n) {
  if (!n.whatsapp) return;
  const caja = $('#waFloat');
  const boton = $('.wa-btn', caja);
  const abrir = () => window.open(enlaceWhatsapp(n, 'Hola, vengo del catálogo de Vivanta y necesito ayuda.'), '_blank', 'noopener');
  let inicioX, inicioY, cajaX, cajaY, movido = false, presionado = false;
  // .left pone el globo de texto del otro lado cuando el boton queda a la izquierda.
  const marcarLado = () => {
    const r = caja.getBoundingClientRect();
    caja.classList.toggle('left', r.left + r.width / 2 < innerWidth / 2);
  };
  const pegarAlCostado = () => {
    const r = caja.getBoundingClientRect();
    const izquierda = r.left + r.width / 2 < innerWidth / 2;
    caja.classList.add('snap');
    caja.classList.toggle('left', izquierda);
    caja.style.left = (izquierda ? 12 : innerWidth - r.width - 12) + 'px';
    caja.style.top = Math.min(Math.max(r.top, 12), innerHeight - r.height - 12) + 'px';
  };
  boton.addEventListener('pointerdown', (e) => {
    caja.classList.remove('snap');
    presionado = true; movido = false;
    inicioX = e.clientX; inicioY = e.clientY;
    const r = caja.getBoundingClientRect();
    cajaX = r.left; cajaY = r.top;
    boton.setPointerCapture(e.pointerId);
  });
  boton.addEventListener('pointermove', (e) => {
    if (!presionado) return;
    const dx = e.clientX - inicioX, dy = e.clientY - inicioY;
    if (!movido && Math.hypot(dx, dy) < 6) return;   // un temblor del dedo no cuenta como arrastre
    movido = true;
    caja.classList.add('dragging', 'sin-globo');
    const r = caja.getBoundingClientRect();
    caja.style.left = Math.min(Math.max(cajaX + dx, 4), innerWidth - r.width - 4) + 'px';
    caja.style.top = Math.min(Math.max(cajaY + dy, 4), innerHeight - r.height - 4) + 'px';
    caja.style.right = 'auto';
    caja.style.bottom = 'auto';
    marcarLado();
  });
  boton.addEventListener('pointerup', () => {
    if (!presionado) return;
    presionado = false;
    caja.classList.remove('dragging');
    if (movido) pegarAlCostado(); else abrir();
  });
  boton.addEventListener('pointercancel', () => {
    presionado = false;
    caja.classList.remove('dragging');
    if (movido) pegarAlCostado();
  });
  // Con el teclado (Enter o espacio) no hay "pointerup": se abre con el click.
  boton.addEventListener('click', (e) => { if (e.detail === 0) abrir(); });
  window.addEventListener('resize', () => { if (caja.style.left) pegarAlCostado(); });
}

// ---------- Aparicion suave al bajar ----------

/** Las secciones y tarjetas aparecen suavemente cuando llegan a la pantalla. */
function prepararAparicion() {
  const observador = 'IntersectionObserver' in window ? new IntersectionObserver((entradas) => entradas.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('visible'); observador.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }) : null;
  const marcar = (el, i) => {
    if (el.classList.contains('fx')) return;
    el.classList.add('fx');
    el.style.transitionDelay = Math.min(i % 4, 3) * 90 + 'ms';   // las tarjetas de una fila entran una tras otra
    if (observador) observador.observe(el); else el.classList.add('visible');
  };
  const preparar = () => {
    $$('.carousel-section, .real-section-heading, .social-section').forEach(marcar);
    $$('.real-promo-card, .real-product-card').forEach(marcar);
  };
  preparar();
  // Cada vez que se dibujan de nuevo las tarjetas (busqueda, marca, categoria), se preparan otra vez.
  new MutationObserver(preparar).observe($('#principal'), { childList: true, subtree: true });
}

iniciar();
