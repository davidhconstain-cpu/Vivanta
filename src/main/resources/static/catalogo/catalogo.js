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
  if (n.tieneLogo) $$('.logo').forEach((img) => { img.src = '/api/public/logo'; });
  dibujarPie(n);

  // Quita del pedido productos que ya no existen.
  for (const id of Object.keys(carrito)) if (!producto(id)) delete carrito[id];
  window.addEventListener('hashchange', mostrar);
  mostrar();
}

function mostrar() {
  if (!catalogo.habilitado) return mantenimiento();
  if (location.hash === '#pedido' && lineas().length) pantallaPedido();
  else pantallaProductos();
  window.scrollTo(0, 0);
}

function mantenimiento() {
  const n = catalogo.negocio;
  $('#barra-pedido').hidden = true;
  $('#principal').innerHTML = `<div class="tarjeta mantenimiento">
    <h1 style="font-size:2rem;margin:0">Catálogo en mantenimiento</h1>
    <p style="margin:0">Estamos actualizando nuestros productos. Escríbenos y con gusto te atendemos.</p>
    ${n.horarios ? `<p style="margin:0"><strong>Horarios:</strong> ${esc(n.horarios)}</p>` : ''}
    ${n.whatsapp ? `<a class="boton primario" target="_blank" rel="noopener" href="https://wa.me/${telWa(n.whatsapp)}">Escribir por WhatsApp</a>` : ''}
  </div>`;
}

function dibujarPie(n) {
  const redes = [['Instagram', n.instagram], ['Facebook', n.facebook], ['TikTok', n.tiktok]].filter(([, u]) => u);
  $('#pie').innerHTML = `
    <img class="logo" src="${n.tieneLogo ? '/api/public/logo' : '/img/logo-vivanta.png'}" alt="${esc(n.nombreNegocio)}">
    ${n.horarios ? `<p>${esc(n.horarios)}</p>` : ''}
    ${n.direccion ? `<p>${esc(n.direccion)}</p>` : ''}
    ${n.telefono ? `<p>Tel. ${esc(n.telefono)}</p>` : ''}
    <div class="redes">
      ${n.whatsapp ? `<a class="boton" target="_blank" rel="noopener" href="https://wa.me/${telWa(n.whatsapp)}">WhatsApp</a>` : ''}
      ${redes.map(([nombre, url]) => `<a class="boton" target="_blank" rel="noopener" href="${esc(url)}">${nombre}</a>`).join('')}
      <button type="button" id="compartir">Compartir catálogo</button>
    </div>`;
  $('#compartir').addEventListener('click', () => {
    const url = location.origin + '/catalogo/';
    if (navigator.share) navigator.share({ title: n.nombreNegocio, url }).catch(() => {});
    else window.open('https://wa.me/?text=' + encodeURIComponent('Mira el catálogo de ' + n.nombreNegocio + ': ' + url), '_blank', 'noopener');
  });
}

// ---------- Pantalla 1: productos ----------

function pantallaProductos() {
  const categorias = [...new Set(catalogo.productos.map((p) => p.categoria).filter(Boolean))].sort();
  $('#principal').innerHTML = `
    <div class="contenedor">
      <div class="filtros">
        <label for="buscar" style="position:absolute;left:-9999px">Buscar productos</label>
        <input id="buscar" type="search" placeholder="Buscar productos" value="${esc(busqueda)}">
        <div class="chips" role="group" aria-label="Categorías">
          <button type="button" data-cat="" aria-pressed="${!categoria}">Todos</button>
          ${categorias.map((c) => `<button type="button" data-cat="${esc(c)}" aria-pressed="${c === categoria}">${esc(c)}</button>`).join('')}
        </div>
      </div>
      <div class="grilla" id="grilla"></div>
    </div>`;
  $('#buscar').addEventListener('input', (e) => { busqueda = e.target.value; dibujarGrilla(); });
  $('.chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    categoria = b.dataset.cat;
    $$('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    dibujarGrilla();
  });
  dibujarGrilla();
}

function dibujarGrilla() {
  const texto = normalizar(busqueda);
  const lista = catalogo.productos.filter((p) => (!categoria || p.categoria === categoria)
    && normalizar(`${p.nombre} ${p.marca} ${p.categoria || ''}`).includes(texto));
  $('#grilla').innerHTML = lista.map((p) => {
    const agotado = p.disponible <= 0;
    const enPedido = carrito[p.id] || 0;
    return `<article class="producto ${agotado ? 'agotado' : ''}">
      <button type="button" class="foto" data-detalle="${p.id}" aria-label="Ver ${esc(p.nombre)}">
        <img src="${foto(p)}" alt="" loading="lazy">
        ${agotado ? '<span class="etiqueta agotado">Agotado</span>' : ''}
      </button>
      <h2>${esc(p.nombre)}</h2>
      <p class="marca-prod" style="margin:0 4px">${esc(p.marca)}</p>
      <p class="precio" style="margin:0 4px">${cop(p.precio)}</p>
      <div class="acciones">
        ${agotado ? '<button type="button" disabled>No disponible</button>'
          : enPedido ? `<div class="stepper"><button type="button" data-menos="${p.id}" aria-label="Quitar una unidad">−</button><output>${enPedido}</output><button type="button" class="mas" data-mas="${p.id}" aria-label="Agregar una unidad">+</button></div>`
          : `<button type="button" class="contorno" data-mas="${p.id}">Agregar</button>`}
      </div>
    </article>`;
  }).join('') || '<p class="vacio" style="grid-column:1/-1">No encontramos productos.</p>';
  actualizarBarra();
}

function actualizarBarra() {
  const ls = lineas();
  const unidades = ls.reduce((s, l) => s + l.cantidad, 0);
  $('#barra-pedido').hidden = unidades === 0 || location.hash === '#pedido';
  $('#barra-cuenta').textContent = `Ver pedido · ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}`;
  $('#barra-total').textContent = cop(ls.reduce((s, l) => s + l.cantidad * l.p.precio, 0));
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
    <p class="cifra" style="font-size:2rem;margin:0">${cop(p.precio)}</p>
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
