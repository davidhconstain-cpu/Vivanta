// =====================================================================
// Catalogo publico de Vivanta Coleccion
// Dos pantallas: la lista de productos (#) y "Tu pedido" (#pedido).
// El pedido se envia por WhatsApp y queda registrado como "pendiente".
// =====================================================================

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const cop = (n) => '$' + Math.round(n || 0).toLocaleString('es-CO');
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const telWa = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.length === 10 ? '57' + d : d; };
const normalizar = (t) => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const foto = (p) => p.imagenes.length ? `/api/public/imagenes/${p.imagenes[0]}` : '/img/isotipo-vivanta.png';

let catalogo = null;
let categoria = '';
let busqueda = '';
let marca = '';
let carrito = cargar('vivanta-carrito', {});        // { productoId: cantidad }
let datosCliente = cargar('vivanta-cliente', {});   // nombre, telefono, direccion, entrega, formaPago...

function cargar(clave, inicial) {
  try { return JSON.parse(localStorage.getItem(clave)) || inicial; } catch { return inicial; }
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
    $('#principal').innerHTML = '<p class="vacio">No pudimos cargar el catálogo. Intenta de nuevo en un momento.</p>';
    return;
  }
  const n = catalogo.negocio;
  document.title = 'Catálogo · ' + n.nombreNegocio;
  if (n.tieneLogo) { $('#banner').src = '/api/public/logo'; $('#menu-logo').src = '/api/public/logo'; }
  if (n.envioGratisDesde > 0) {
    $('#anuncio').innerHTML = `<span class="destello">✦</span><span>Envío gratis en compras desde</span><strong>${cop(n.envioGratisDesde)}</strong><span class="destello">✦</span>`;
    $('#anuncio').hidden = false;
  }
  dibujarPie(n);
  dibujarMenu(n);

  // Quita del pedido productos que ya no existen.
  for (const id of Object.keys(carrito)) if (!producto(id)) delete carrito[id];
  window.addEventListener('hashchange', mostrar);
  mostrar();
}

function mostrar() {
  if (!catalogo.habilitado) return mantenimiento();
  const enPedido = location.hash === '#pedido' && lineas().length;
  $('#cabeza').classList.toggle('compacta', Boolean(enPedido));
  if (enPedido) pantallaPedido();
  else pantallaProductos();
  window.scrollTo(0, 0);
}

function mantenimiento() {
  const n = catalogo.negocio;
  $('#barra-pedido').hidden = true;
  $('#principal').innerHTML = `<div class="contenedor"><div class="tarjeta mantenimiento">
    <h1 style="font-size:2rem;margin:0">Catálogo en mantenimiento</h1>
    <p style="margin:0">Estamos actualizando nuestros productos. Escríbenos y con gusto te atendemos.</p>
    ${n.horarios ? `<p style="margin:0"><strong>Horarios:</strong> ${esc(n.horarios)}</p>` : ''}
    ${n.whatsapp ? `<a class="boton primario" target="_blank" rel="noopener" href="https://wa.me/${telWa(n.whatsapp)}">Escribir por WhatsApp</a>` : ''}
  </div></div>`;
}

const ICONO_OFERTA ='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1"/></svg>';

const FRASE = 'Un universo de belleza por descubrir.';
/** Enlace de WhatsApp con un mensaje ya escrito (para "Información de compra"). */
const enlaceWhatsapp = (n, texto) => n.whatsapp ? `https://wa.me/${telWa(n.whatsapp)}?text=${encodeURIComponent(texto)}` : '';
const categoriasDelCatalogo = () => [...new Set(catalogo.productos.map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

/** Pie color vino: nombre, frase, datos, redes con sus logos, enlaces y derechos. */
function dibujarPie(n) {
  const red = (clase, nombre, url) => `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="/img/redes/${clase}.png" alt="">${nombre}</a>`;
  const redes = [
    n.whatsapp && red('whatsapp', 'WhatsApp', 'https://wa.me/' + telWa(n.whatsapp)),
    n.instagram && red('instagram', 'Instagram', n.instagram),
    n.facebook && red('facebook', 'Facebook', n.facebook),
    n.tiktok && red('tiktok', 'TikTok', n.tiktok),
  ].filter(Boolean);
  const info = enlaceWhatsapp(n, 'Hola, quiero información de compra.');
  $('#pie').innerHTML = `
    <div class="pie-logo">${esc(n.nombreNegocio.replace(/\s+Colecci[oó]n$/i, ''))}</div>
    <p class="pie-frase">${FRASE}</p>
    ${n.horarios || n.direccion || n.telefono ? `<p class="pie-datos">${[n.horarios, n.direccion, n.telefono && 'Tel. ' + n.telefono].filter(Boolean).map(esc).join('<br>')}</p>` : ''}
    <section class="redes-caja" id="contactos" aria-label="Redes sociales">
      <h2>Síguenos en nuestras redes sociales</h2>
      <div class="redes" style="--columnas:${redes.length + 1}">
        ${redes.join('')}
        <button type="button" id="compartir"><img src="/img/redes/compartir.png" alt="">Compartir</button>
      </div>
    </section>
    <div class="pie-enlaces">
      ${info ? `<a href="${info}" target="_blank" rel="noopener">Información de compra</a>` : ''}
      <button type="button" data-ir-contactos>Contactos</button>
    </div>
    <div class="derechos">© ${new Date().getFullYear()} ${esc(n.nombreNegocio)}. Todos los derechos reservados.</div>`;
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

/** Menu lateral: categorias, ofertas y sets; despues informacion de compra y contactos. */
function dibujarMenu(n) {
  const boton = (dato, texto, clase = '') => `<button type="button" data-ir-cat="${esc(dato)}" class="${clase}">${esc(texto)}</button>`;
  const info = enlaceWhatsapp(n, 'Hola, quiero información de compra.');
  $('#menu-contenido').innerHTML = `
    <nav aria-label="Categorías">
      ${boton('', 'Todos los productos')}
      ${catalogo.productos.some((p) => p.precioAntes) ? boton(OFERTAS, 'Ofertas') : ''}
      ${catalogo.productos.some((p) => p.combo) ? boton(SETS, 'Sets') : ''}
      ${categoriasDelCatalogo().map((c) => boton(c, c)).join('')}
    </nav>
    <div class="menu-separador"></div>
    <nav aria-label="Información">
      ${info ? `<a class="especial" href="${info}" target="_blank" rel="noopener">Información de compra</a>` : ''}
      <button type="button" class="especial" data-ir-contactos>Contactos</button>
    </nav>`;
  const abrir = (si) => {
    $('#menu').classList.toggle('abierto', si);
    $('#menu-sombra').hidden = !si;
    $('#abrir-menu').setAttribute('aria-expanded', String(si));
    if (si) $('#cerrar-menu').focus();
  };
  $('#abrir-menu').addEventListener('click', () => abrir(true));
  $('#cerrar-menu').addEventListener('click', () => abrir(false));
  $('#menu-sombra').addEventListener('click', () => abrir(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrir(false); });
  // Categorias (menu, tarjetas destacadas y pie) y "Contactos" funcionan igual desde cualquier lugar.
  document.addEventListener('click', (e) => {
    const cat = e.target.closest('[data-ir-cat]');
    const contactos = e.target.closest('[data-ir-contactos]');
    if (cat) { abrir(false); irACategoria(cat.dataset.irCat); }
    if (contactos) { abrir(false); $('#contactos').scrollIntoView({ block: 'start' }); }
  });
}

/** Filtra por categoria y baja hasta los productos. */
function irACategoria(cat) {
  categoria = cat;
  const bajar = () => $('#productos')?.scrollIntoView({ block: 'start' });
  if (location.hash === '#pedido') { location.hash = ''; setTimeout(bajar, 80); } else { pantallaProductos(); requestAnimationFrame(bajar); }
}

// ---------- Pantalla 1: productos ----------

function pantallaProductos() {
  const marcas = [...new Set(catalogo.productos.map((p) => p.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const cuantos = (m) => catalogo.productos.filter((p) => p.marca === m).length;
  const destacadas = catalogo.categoriasDestacadas || [];
  const promos = catalogo.promociones || [];
  $('#principal').innerHTML = `
    <section class="intro">
      <p class="frase">${FRASE}</p>
      <div class="adorno" aria-hidden="true">──── ✦ ────</div>
      <h1 class="titulo-coleccion">Explora nuestra colección</h1>
      <p class="subtitulo-coleccion">Encuentra tus favoritos y descubre<br>todo lo que tenemos para ti.</p>
      <div class="herramientas">
        <div class="buscador">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
          <label for="buscar" class="oculto">Buscar productos</label>
          <input id="buscar" type="search" placeholder="Buscar productos" value="${esc(busqueda)}">
        </div>
        ${marcas.length > 1 ? `<label for="filtro-marca" class="oculto">Marca</label>
        <select id="filtro-marca" class="${marca ? 'elegida' : ''}">
          <option value="">Todas las marcas</option>
          ${marcas.map((m) => `<option value="${esc(m)}" ${m === marca ? 'selected' : ''}>${esc(m)} (${cuantos(m)})</option>`).join('')}
        </select>` : ''}
      </div>
    </section>
    ${destacadas.length ? `<section class="seccion" aria-label="Categorías más buscadas">
      <h2 class="titulo-seccion">Nuestras categorías <em>más buscadas</em></h2>
      <div class="tarjetas-categoria" style="--columnas:${destacadas.length}">
        ${destacadas.map((c) => `<button type="button" class="tarjeta-categoria" data-ir-cat="${esc(c.nombre)}">
          <span class="arte ${c.imagenUrl ? '' : 'sin-foto'}">${c.imagenUrl ? `<img src="${esc(c.imagenUrl)}" alt="" loading="lazy">` : '<span aria-hidden="true">✿</span>'}</span>
          <span class="nombre">${esc(c.nombre)}</span></button>`).join('')}
      </div></section>` : ''}
    ${promos.length ? `<section class="carrusel" aria-label="Promociones destacadas">
      <div class="carrusel-ventana" id="carrusel">
        ${promos.map((p) => `<article class="promo" ${p.productoId && producto(p.productoId) ? `data-producto="${p.productoId}" tabindex="0"` : ''}>
          <div class="promo-foto">${p.imagenUrl ? `<img src="${esc(p.imagenUrl)}" alt="" loading="lazy">` : '<span aria-hidden="true">✦</span>'}</div>
          <div>${p.marca ? `<div class="promo-marca">${esc(p.marca)}</div>` : ''}<h3>${esc(p.titulo)}</h3>${p.texto ? `<p>${esc(p.texto)}</p>` : ''}
            ${p.productoId && producto(p.productoId) ? '<span class="ver">Ver producto</span>' : ''}</div>
        </article>`).join('')}
      </div>
      ${promos.length > 1 ? `<div class="puntos">${promos.map((_, i) => `<button type="button" data-punto="${i}" aria-label="Promoción ${i + 1}" aria-current="${i === 0}"></button>`).join('')}</div>` : ''}
    </section>` : ''}
    <div class="contenedor" id="productos">
      <h2 class="titulo-seccion">Nuestros <em>productos</em></h2>
      <div class="filtro-activo" id="filtro-activo" aria-live="polite"></div>
      <div class="grilla" id="grilla"></div>
    </div>`;
  $('#buscar').addEventListener('input', (e) => { busqueda = e.target.value; dibujarGrilla(); });
  $('#filtro-marca')?.addEventListener('change', (e) => {
    marca = e.target.value;
    e.target.classList.toggle('elegida', Boolean(marca));
    dibujarGrilla();
  });
  // Las categorias se eligen en el menu o en las tarjetas destacadas; aqui solo el aviso de ofertas y "Ver todos".
  $('#principal').onclick = (e) => {
    const promo = e.target.closest('[data-producto]');
    if (promo) { verDetalle(producto(promo.dataset.producto)); return; }
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    categoria = b.dataset.cat;
    dibujarGrilla();
  };
  $('#principal').onkeydown = (e) => {
    const promo = e.target.closest('[data-producto]');
    if (promo && e.key === 'Enter') verDetalle(producto(promo.dataset.producto));
  };
  activarCarrusel();
  dibujarGrilla();
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
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    temporizadorCarrusel = setInterval(() => { if (document.contains(ventana)) ir(actual() + 1); else clearInterval(temporizadorCarrusel); }, 6000);
  };
  ventana.addEventListener('pointerdown', reiniciar);
  reiniciar();
}

const OFERTAS = "__ofertas__";
const SETS = '__sets__';
const descuento = (p) => Math.round((1 - p.precio / p.precioAntes) * 100);
const fechaLarga = (d) => new Date(d + "T00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long" });
/** Precio tachado: el normal si hay oferta; en un set sin oferta, lo que costaria por separado. */
const tachado = (p) => p.precioAntes || (p.combo && p.precioSeparado > p.precio ? p.precioSeparado : 0);

/** Precio de la tarjeta: con oferta o set, el precio anterior tachado y lo que se ahorra. */
function precioHtml(p) {
  const antes = tachado(p);
  if (!antes) return `<p class="precio">${cop(p.precio)}</p>`;
  return `<p class="precio">${cop(p.precio)} <s class="antes">${cop(antes)}</s></p>
      ${p.precioAntes && p.ofertaHasta ? `<p class="vigencia">Hasta el ${fechaLarga(p.ofertaHasta)}</p>`
        : !p.precioAntes ? `<p class="vigencia">Ahorras ${cop(antes - p.precio)}</p>` : ''}`;
}

function dibujarGrilla() {
  const texto = normalizar(busqueda);
  // Sin la fila de categorias, se indica que filtro esta puesto y como quitarlo.
  const nombreFiltro = categoria === OFERTAS ? 'Ofertas' : categoria === SETS ? 'Sets' : categoria;
  $('#filtro-activo').innerHTML = nombreFiltro
    ? `<span>Mostrando: <strong>${esc(nombreFiltro)}</strong></span><button type="button" data-cat="">Ver todos los productos ✕</button>` : '';
  const lista = catalogo.productos.filter((p) => (!categoria || p.categoria === categoria
      || (categoria === OFERTAS && p.precioAntes) || (categoria === SETS && p.combo))
    && (!marca || p.marca === marca)
    && normalizar(`${p.nombre} ${p.marca} ${p.categoria || ''}`).includes(texto));
  const hayOfertas = catalogo.productos.some((p) => p.precioAntes && p.disponible > 0);
  const avisoOfertas = hayOfertas && !categoria && !marca && !texto
    ? `<button type="button" class="aviso-ofertas" data-cat="${OFERTAS}"><span class="tile">${ICONO_OFERTA.replace(/16/g, '20')}</span>
        <span><strong>Ofertas especiales</strong><span class="texto">Precios especiales en productos seleccionados</span></span></button>` : '';
  $('#grilla').innerHTML = avisoOfertas + lista.map((p) => {
    const agotado = p.disponible <= 0;
    const enPedido = carrito[p.id] || 0;
    return `<article class="producto ${agotado ? 'agotado' : ''}">
      <button type="button" class="foto ${p.imagenes.length ? 'con-foto' : ''}" data-detalle="${p.id}" aria-label="Ver ${esc(p.nombre)}">
        <img src="${foto(p)}" alt="" loading="lazy" class="${p.imagenes.length ? '' : 'sin-foto'}">
        ${agotado ? '<span class="etiqueta agotado">Agotado</span>' : ''}
      </button>
      <div class="cuerpo">
        ${p.categoria ? `<span class="categoria-prod">${esc(p.categoria)}</span>` : ''}
        ${p.combo || (p.precioAntes && !agotado) ? `<div class="pastillas">
          ${p.combo ? '<span class="pastilla-set">Set</span>' : ''}
          ${p.precioAntes && !agotado ? `<span class="pastilla-oferta">Oferta −${descuento(p)} %</span>` : ''}</div>` : ''}
        <h2>${esc(p.nombre)}</h2>
        ${p.combo ? `<p class="incluye">Incluye: ${esc(p.incluye)}</p>` : `<p class="marca-prod">${esc(p.marca)}</p>`}
        ${precioHtml(p)}
        <div class="acciones">
          ${agotado ? '<button type="button" disabled>No disponible</button>'
            : enPedido ? `<div class="stepper"><button type="button" data-menos="${p.id}" aria-label="Quitar una unidad">−</button><output>${enPedido}</output><button type="button" class="mas" data-mas="${p.id}" aria-label="Agregar una unidad">+</button></div>`
            : `<button type="button" class="contorno" data-mas="${p.id}">Agregar</button>`}
        </div>
      </div>
    </article>`;
  }).join('') + (lista.length ? '' : '<p class="vacio" style="grid-column:1/-1">No encontramos productos.</p>');
  actualizarBarra();
}

function actualizarBarra() {
  const ls = lineas();
  const unidades = ls.reduce((s, l) => s + l.cantidad, 0);
  $('#barra-pedido').hidden = unidades === 0 || location.hash === '#pedido';
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
  const nueva = (carrito[id] || 0) + delta;
  if (nueva > p.disponible) {
    avisar('Solo hay ' + p.disponible + ' unidades disponibles', 'error');
    return;
  }
  if (nueva <= 0) delete carrito[id];
  else carrito[id] = nueva;
  guardar();
  if (location.hash === '#pedido') {
    if (lineas().length) pantallaPedido(); else location.hash = '';
  } else {
    dibujarGrilla();
  }
}

document.addEventListener('click', (e) => {
  const mas = e.target.closest('[data-mas]');
  const menos = e.target.closest('[data-menos]');
  const detalle = e.target.closest('[data-detalle]');
  if (mas) cambiarCantidad(mas.dataset.mas, 1);
  if (menos) cambiarCantidad(menos.dataset.menos, -1);
  if (detalle) verDetalle(producto(detalle.dataset.detalle));
});

/**
 * Detalle del producto: foto a la izquierda y datos a la derecha (en el celular, uno debajo del otro).
 * En un set se listan los productos que incluye, cada uno con su foto.
 */
function verDetalle(p) {
  const fotos = p.imagenes.length ? p.imagenes.map((i) => `/api/public/imagenes/${i}`) : [foto(p)];
  const antes = tachado(p);
  const porcentaje = antes ? Math.round((1 - p.precio / antes) * 100) : 0;
  const quedan = p.disponible - (carrito[p.id] || 0);
  let cantidad = 1;
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `<div class="modal detalle-producto" role="dialog" aria-label="${esc(p.nombre)}">
    <button class="icono cerrar-detalle" data-cerrar aria-label="Cerrar">✕</button>
    <div class="detalle-grid">
      <div class="detalle-galeria">
        <div class="foto-grande ${p.imagenes.length ? 'con-foto' : ''}">
          <img id="foto-grande" src="${fotos[0]}" alt="${esc(p.nombre)}" class="${p.imagenes.length ? '' : 'sin-foto'}">
          ${porcentaje > 0 ? `<span class="insignia-descuento">−${porcentaje} %</span>` : ''}
        </div>
        ${fotos.length > 1 ? `<div class="miniaturas">${fotos.map((f, i) => `<button type="button" data-foto="${i}" aria-label="Foto ${i + 1}" aria-pressed="${i === 0}"><img src="${f}" alt=""></button>`).join('')}</div>` : ''}
      </div>
      <div class="detalle-info">
        ${p.combo ? '<span class="pastilla-set">Set</span>' : p.categoria ? `<span class="categoria-prod">${esc(p.categoria)}</span>` : ''}
        <h2 class="detalle-nombre">${esc(p.nombre)}</h2>
        <p class="suave" style="margin:0">${esc(p.marca)}${p.combo && p.categoria ? ' · ' + esc(p.categoria) : ''}</p>
        <p class="detalle-precio">${antes ? `<s class="antes">${cop(antes)}</s>` : ''}<span>${cop(p.precio)}</span></p>
        ${p.precioAntes ? `<p class="vigencia" style="margin:0">Oferta −${descuento(p)} %${p.ofertaHasta ? ' · hasta el ' + fechaLarga(p.ofertaHasta) : ''}</p>`
          : p.combo && antes ? `<p class="vigencia" style="margin:0">Ahorras ${cop(antes - p.precio)} comprando el set</p>` : ''}
        ${p.combo && p.productosDelSet?.length ? `<div class="incluye-set"><h3>Este set incluye</h3><ul>${p.productosDelSet.map((c) => `<li>
            <img src="${c.imagenId ? '/api/public/imagenes/' + c.imagenId : '/img/isotipo-vivanta.png'}" alt="" loading="lazy">
            <div><strong>${c.cantidad > 1 ? c.cantidad + ' × ' : ''}${esc(c.nombre)}</strong><span>Precio suelto ${cop(c.precio)}</span></div></li>`).join('')}</ul></div>` : ''}
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
  fondo.addEventListener('click', (e) => {
    if (e.target === fondo || e.target.closest('[data-cerrar]')) fondo.remove();
    const miniatura = e.target.closest('[data-foto]');
    if (miniatura) {
      $('#foto-grande', fondo).src = fotos[miniatura.dataset.foto];
      $$('[data-foto]', fondo).forEach((b) => b.setAttribute('aria-pressed', String(b === miniatura)));
    }
  });
  if (quedan > 0) {
    const mostrar = () => { $('#det-cantidad', fondo).textContent = cantidad; };
    $('#det-menos', fondo).addEventListener('click', () => { cantidad = Math.max(1, cantidad - 1); mostrar(); });
    $('#det-mas', fondo).addEventListener('click', () => {
      if (cantidad >= quedan) { avisar('Solo hay ' + p.disponible + ' unidades disponibles', 'error'); return; }
      cantidad += 1; mostrar();
    });
    $('#det-agregar', fondo).addEventListener('click', () => {
      cambiarCantidad(p.id, cantidad);
      avisar(cantidad + (cantidad === 1 ? ' unidad agregada' : ' unidades agregadas') + ' a tu pedido');
      fondo.remove();
    });
  }
  document.body.append(fondo);
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
  $('#barra-pedido').hidden = true;
  $('#principal').innerHTML = `
    <form class="pedido" id="form-pedido">
      <header>
        <a class="volver" href="#">← Seguir comprando</a>
        <h1>Tu pedido</h1>
      </header>
      <section class="tarjeta" style="padding:0">
        <ul class="items">${ls.map(({ p, cantidad }) => `<li>
          <img src="${foto(p)}" alt="">
          <div class="texto"><strong>${esc(p.nombre)}</strong><span>${cantidad} × ${cop(p.precio)}</span>
            <div class="quitar"><button type="button" data-menos="${p.id}" aria-label="Quitar una unidad">−</button><button type="button" data-mas="${p.id}" aria-label="Agregar una unidad">+</button></div></div>
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
        ? '<button class="primario whatsapp" id="enviar">Enviar pedido por WhatsApp</button>'
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
  } catch (error) {
    if (ventana) ventana.close();
    avisar(error.message, 'error');
    boton.disabled = false;
    boton.textContent = 'Enviar pedido por WhatsApp';
  }
}

iniciar();
