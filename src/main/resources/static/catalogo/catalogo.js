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
  if (n.tieneLogo) $('#banner').src = '/api/public/logo';
  dibujarPie(n);

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

/** Logos de las redes (dibujados en SVG para no depender de otros sitios). */
const ICONOS_REDES = {
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.2A9.8 9.8 0 0 0 3.6 17l-1.4 5 5.2-1.4A9.8 9.8 0 1 0 12 2.2zm0 17.8c-1.5 0-3-.4-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.1 8.1 0 1 1 12 20z"/><path d="M16.5 14.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.7-.3-1.4-.7-2-1.3-.5-.5-.9-1-1.3-1.6-.1-.2 0-.4.1-.5l.4-.5.3-.5v-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.8.8-1 1.8-.7 2.8.3 1 .9 1.9 1.6 2.7 1.3 1.6 3 2.7 4.9 3.2.6.2 1.3.2 1.9.1.7-.2 1.4-.7 1.6-1.4.1-.3.1-.7 0-1l-.6-.3z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.2h2.8V22h3.4z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 2h-3.3v13.4a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .8.1V9.2l-.8-.1a6.2 6.2 0 1 0 6.2 6.2V8.6a8 8 0 0 0 4.7 1.5V6.8a4.7 4.7 0 0 1-4.7-4.8z"/></svg>',
  compartir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
};
const ICONO_OFERTA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1"/></svg>';

function dibujarPie(n) {
  const red = (clase, nombre, url) => `<a href="${esc(url)}" target="_blank" rel="noopener"><span class="circulo red-${clase}">${ICONOS_REDES[clase]}</span>${nombre}</a>`;
  const redes = [
    n.whatsapp && red('whatsapp', 'WhatsApp', 'https://wa.me/' + telWa(n.whatsapp)),
    n.instagram && red('instagram', 'Instagram', n.instagram),
    n.facebook && red('facebook', 'Facebook', n.facebook),
    n.tiktok && red('tiktok', 'TikTok', n.tiktok),
  ].filter(Boolean).join('');
  const categorias = catalogo.habilitado ? [...new Set(catalogo.productos.map((p) => p.categoria).filter(Boolean))].sort() : [];
  $('#pie').innerHTML = `
    <img class="logo" src="${n.tieneLogo ? '/api/public/logo' : '/img/logo-vivanta.png'}" alt="${esc(n.nombreNegocio)}">
    ${n.horarios ? `<p>${esc(n.horarios)}</p>` : ''}
    ${n.direccion ? `<p>${esc(n.direccion)}</p>` : ''}
    ${n.telefono ? `<p>Tel. ${esc(n.telefono)}</p>` : ''}
    ${categorias.length ? `<h2>Categorías</h2><nav class="categorias-pie" aria-label="Categorías">${categorias.map((c) => `<a href="#" data-ir-cat="${esc(c)}">${esc(c)}</a>`).join('')}</nav>` : ''}
    <h2>Síguenos</h2>
    <div class="redes">
      ${redes}
      <button type="button" id="compartir"><span class="circulo red-compartir">${ICONOS_REDES.compartir}</span>Compartir</button>
    </div>`;
  $('#compartir').addEventListener('click', () => {
    const url = location.origin + '/catalogo/';
    if (navigator.share) navigator.share({ title: n.nombreNegocio, url }).catch(() => {});
    else window.open('https://wa.me/?text=' + encodeURIComponent('Mira el catálogo de ' + n.nombreNegocio + ': ' + url), '_blank', 'noopener');
  });
  $$('[data-ir-cat]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    categoria = a.dataset.irCat;
    if (location.hash === '#pedido') location.hash = ''; else pantallaProductos();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}

// ---------- Pantalla 1: productos ----------

function pantallaProductos() {
  const categorias = [...new Set(catalogo.productos.map((p) => p.categoria).filter(Boolean))].sort();
  $('#principal').innerHTML = `
    <div class="contenedor">
      <h1 class="titulo-catalogo">Nuestros productos</h1>
      <div class="filtros">
        <label for="buscar" style="position:absolute;left:-9999px">Buscar productos</label>
        <input id="buscar" type="search" placeholder="Buscar productos" value="${esc(busqueda)}">
        <div class="chips" role="group" aria-label="Categorías">
          <button type="button" data-cat="" aria-pressed="${!categoria}">Todos</button>
          ${catalogo.productos.some((p) => p.precioAntes) ? `<button type="button" class="chip-oferta" data-cat="${OFERTAS}" aria-pressed="${categoria === OFERTAS}">${ICONO_OFERTA}Ofertas</button>` : ''}
          ${categorias.map((c) => `<button type="button" data-cat="${esc(c)}" aria-pressed="${c === categoria}">${esc(c)}</button>`).join('')}
        </div>
      </div>
      <div class="grilla" id="grilla"></div>
    </div>`;
  $('#buscar').addEventListener('input', (e) => { busqueda = e.target.value; dibujarGrilla(); });
  // Un solo manejador para los chips y el aviso de ofertas de la grilla.
  $('#principal').onclick = (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    categoria = b.dataset.cat;
    $$('.chips [data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.cat === categoria)));
    dibujarGrilla();
  };
  dibujarGrilla();
}

const OFERTAS = "__ofertas__";
const descuento = (p) => Math.round((1 - p.precio / p.precioAntes) * 100);
const fechaLarga = (d) => new Date(d + "T00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long" });

/** Precio de la tarjeta: con oferta, el normal tachado al lado y hasta cuando dura. */
function precioHtml(p) {
  if (!p.precioAntes) return `<p class="precio">${cop(p.precio)}</p>`;
  return `<p class="precio">${cop(p.precio)} <s class="antes">${cop(p.precioAntes)}</s></p>
      ${p.ofertaHasta ? `<p class="vigencia">Hasta el ${fechaLarga(p.ofertaHasta)}</p>` : ''}`;
}

function dibujarGrilla() {
  const texto = normalizar(busqueda);
  const lista = catalogo.productos.filter((p) => (!categoria || p.categoria === categoria || (categoria === OFERTAS && p.precioAntes))
    && normalizar(`${p.nombre} ${p.marca} ${p.categoria || ''}`).includes(texto));
  const hayOfertas = catalogo.productos.some((p) => p.precioAntes && p.disponible > 0);
  const avisoOfertas = hayOfertas && !categoria && !texto
    ? `<button type="button" class="aviso-ofertas" data-cat="${OFERTAS}"><span class="tile">${ICONO_OFERTA.replace(/16/g, '20')}</span>
        <span><strong>Ofertas especiales</strong><span class="texto">Precios especiales en productos seleccionados</span></span></button>` : '';
  $('#grilla').innerHTML = avisoOfertas + lista.map((p) => {
    const agotado = p.disponible <= 0;
    const enPedido = carrito[p.id] || 0;
    return `<article class="producto ${agotado ? 'agotado' : ''}">
      <button type="button" class="foto" data-detalle="${p.id}" aria-label="Ver ${esc(p.nombre)}">
        <img src="${foto(p)}" alt="" loading="lazy" class="${p.imagenes.length ? '' : 'sin-foto'}">
        ${agotado ? '<span class="etiqueta agotado">Agotado</span>' : ''}
      </button>
      <div class="cuerpo">
        ${p.categoria ? `<span class="categoria-prod">${esc(p.categoria)}</span>` : ''}
        ${p.precioAntes && !agotado ? `<span class="pastilla-oferta">Oferta −${descuento(p)} %</span>` : ''}
        <h2>${esc(p.nombre)}</h2>
        <p class="marca-prod">${esc(p.marca)}</p>
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
  $('#barra-total').textContent = cop(ls.reduce((s, l) => s + l.cantidad * l.p.precio, 0));
  const domicilio = catalogo.negocio.costoDomicilio;
  $('#barra-nota').textContent = 'Pedidos por WhatsApp' + (domicilio ? ' · Domicilio ' + cop(domicilio) : '');
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

function verDetalle(p) {
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `<div class="modal">
    <div class="modal-cabecera"><h2>${esc(p.nombre)}</h2><button class="icono" data-cerrar aria-label="Cerrar">✕</button></div>
    <div class="detalle-fotos">${p.imagenes.length ? p.imagenes.map((i) => `<img src="/api/public/imagenes/${i}" alt="">`).join('') : `<img src="${foto(p)}" alt="">`}</div>
    <p class="suave">${esc(p.marca)}${p.categoria ? ' · ' + esc(p.categoria) : ''}</p>
    ${p.descripcion ? `<p style="white-space:pre-line">${esc(p.descripcion)}</p>` : ''}
    <p class="cifra" style="font-size:2rem;margin:0">${p.precioAntes ? `<s class="antes">${cop(p.precioAntes)}</s> ` : ""}${cop(p.precio)}</p>
    ${p.precioAntes ? `<p class="vigencia" style="margin:0">Oferta −${descuento(p)} %${p.ofertaHasta ? " · hasta el " + fechaLarga(p.ofertaHasta) : ""}</p>` : ""}
    <div class="modal-pie">${p.disponible > 0 ? `<button class="primario" data-mas="${p.id}" data-cerrar>Agregar al pedido</button>` : '<span class="etiqueta agotado">Agotado</span>'}</div>
  </div>`;
  fondo.addEventListener('click', (e) => { if (e.target === fondo || e.target.closest('[data-cerrar]')) fondo.remove(); });
  document.body.append(fondo);
}

// ---------- Pantalla 2: tu pedido ----------

function pantallaPedido() {
  const n = catalogo.negocio;
  const ls = lineas();
  const entrega = datosCliente.entrega || 'RECOGIDA';
  const formaPago = datosCliente.formaPago || 'ANTICIPADO';
  const subtotal = ls.reduce((s, l) => s + l.cantidad * l.p.precio, 0);
  const domicilio = entrega === 'DOMICILIO' ? n.costoDomicilio : 0;
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
        ${opcion('entrega', 'DOMICILIO', 'Domicilio' + (n.costoDomicilio ? ' (' + cop(n.costoDomicilio) + ')' : ''), entrega)}
      </fieldset>
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
        ${domicilio ? `<div><span class="suave">Domicilio</span><span>${cop(domicilio)}</span></div>` : ''}
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
