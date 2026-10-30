// =====================================================================
// Catalogo publico de Vivanet Coleccion
// Los clientes eligen productos, arman el carrito y envian el pedido
// por WhatsApp. El pedido queda registrado como "pendiente".
// =====================================================================

const $ = (s, r = document) => r.querySelector(s);
const cop = (n) => '$' + Math.round(n || 0).toLocaleString('es-CO');
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const telWa = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.length === 10 ? '57' + d : d; };

let catalogo = null;
let categoria = '';
let carrito = cargarCarrito();   // { productoId: cantidad }
let datosCliente = cargarDatos(); // nombre, telefono, direccion... (se recuerdan en este navegador)

function cargarCarrito() {
  try { return JSON.parse(localStorage.getItem('vivanet-carrito')) || {}; } catch { return {}; }
}
function cargarDatos() {
  try { return JSON.parse(localStorage.getItem('vivanet-cliente')) || {}; } catch { return {}; }
}
function guardar() {
  try {
    localStorage.setItem('vivanet-carrito', JSON.stringify(carrito));
    localStorage.setItem('vivanet-cliente', JSON.stringify(datosCliente));
  } catch { /* sin almacenamiento: el carrito vive solo en esta pagina */ }
}

function avisar(texto, tipo = '') {
  const caja = document.createElement('div');
  caja.className = 'aviso ' + tipo;
  caja.textContent = texto;
  $('#avisos').append(caja);
  setTimeout(() => caja.remove(), 4000);
}

async function iniciar() {
  try {
    const r = await fetch('/api/public/catalogo');
    catalogo = await r.json();
  } catch {
    $('#principal').innerHTML = '<p class="vacio">No pudimos cargar el catálogo. Intenta de nuevo en un momento.</p>';
    return;
  }
  const n = catalogo.negocio;
  document.title = 'Catálogo · ' + n.nombreNegocio;
  $('#portada').innerHTML = `${n.tieneLogo ? `<img src="/api/public/logo" alt="${esc(n.nombreNegocio)}">` : ''}
    <h1>${esc(n.nombreNegocio)}</h1><p>Belleza que te acompaña · Haz tu pedido por WhatsApp</p>`;
  dibujarPie(n);

  if (!catalogo.habilitado) {
    $('#principal').innerHTML = `<div class="tarjeta mantenimiento">
      <h2>Catálogo en mantenimiento</h2>
      <p>Estamos actualizando nuestros productos. Escríbenos y con gusto te atendemos.</p>
      ${n.horarios ? `<p><strong>Horarios:</strong> ${esc(n.horarios)}</p>` : ''}
      ${n.whatsapp ? `<a class="boton whatsapp" target="_blank" rel="noopener" href="https://wa.me/${telWa(n.whatsapp)}">Escribir por WhatsApp</a>` : ''}
    </div>`;
    return;
  }

  // Quita del carrito productos que ya no existen.
  for (const id of Object.keys(carrito)) {
    if (!catalogo.productos.some((p) => p.id === Number(id))) delete carrito[id];
  }
  const categorias = [...new Set(catalogo.productos.map((p) => p.categoria).filter(Boolean))].sort();
  $('#principal').innerHTML = `
    <div class="filtros">
      <input type="search" id="buscar" placeholder="Buscar producto o marca">
      <div class="chips" id="chips">
        <button class="chip activo" data-cat="">Todo</button>
        ${categorias.map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
    </div>
    <div class="grilla" id="grilla"></div>`;
  $('#buscar').addEventListener('input', dibujarProductos);
  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    categoria = b.dataset.cat;
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('activo', c === b));
    dibujarProductos();
  });
  dibujarProductos();
  actualizarBoton();
}

function dibujarPie(n) {
  const redes = [['Instagram', n.instagram], ['Facebook', n.facebook], ['TikTok', n.tiktok]].filter(([, u]) => u);
  $('#pie').innerHTML = `
    <div class="marca" style="font-size:1.3rem">${esc(n.nombreNegocio)}</div>
    ${n.horarios ? `<p>🕒 ${esc(n.horarios)}</p>` : ''}
    ${n.direccion ? `<p>📍 ${esc(n.direccion)}</p>` : ''}
    ${n.telefono ? `<p>📞 ${esc(n.telefono)}</p>` : ''}
    <div class="redes">
      ${n.whatsapp ? `<a class="boton" target="_blank" rel="noopener" href="https://wa.me/${telWa(n.whatsapp)}">WhatsApp</a>` : ''}
      ${redes.map(([nombre, url]) => `<a class="boton" target="_blank" rel="noopener" href="${esc(url)}">${nombre}</a>`).join('')}
      <button type="button" id="compartir">Compartir catálogo</button>
    </div>`;
  $('#compartir').addEventListener('click', async () => {
    const url = location.origin + '/catalogo/';
    if (navigator.share) {
      navigator.share({ title: n.nombreNegocio, url }).catch(() => {});
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent('Mira el catálogo de ' + n.nombreNegocio + ': ' + url), '_blank', 'noopener');
    }
  });
}

function normalizar(t) {
  return String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function dibujarProductos() {
  const texto = normalizar($('#buscar').value);
  const lista = catalogo.productos.filter((p) => (!categoria || p.categoria === categoria)
    && normalizar(p.nombre + ' ' + p.marca + ' ' + (p.categoria || '')).includes(texto));
  $('#grilla').innerHTML = lista.map((p) => {
    const agotado = p.disponible <= 0;
    const enCarrito = carrito[p.id] || 0;
    return `<article class="producto ${agotado ? 'agotado' : ''}">
      <button class="foto" data-detalle="${p.id}" aria-label="Ver ${esc(p.nombre)}">
        ${p.imagenes.length ? `<img src="/api/public/imagenes/${p.imagenes[0]}" alt="${esc(p.nombre)}" loading="lazy">` : `<div class="sin-foto">${esc(p.nombre.charAt(0))}</div>`}
        ${agotado ? '<span class="etiqueta agotado">Agotado</span>' : ''}
      </button>
      <div class="info">
        <span class="marca-prod">${esc(p.marca)}</span>
        <span class="nombre">${esc(p.nombre)}</span>
        <span class="precio">${cop(p.precio)}</span>
        ${agotado ? '<button disabled>Agotado</button>'
          : enCarrito ? `<div class="cantidad" style="justify-content:space-between"><button data-menos="${p.id}" aria-label="Quitar uno">−</button><strong>${enCarrito} en tu pedido</strong><button data-mas="${p.id}" aria-label="Agregar uno">+</button></div>`
          : `<button class="primario" data-mas="${p.id}" style="justify-content:center">Agregar</button>`}
      </div></article>`;
  }).join('') || '<p class="vacio" style="grid-column:1/-1">No encontramos productos.</p>';
}

function producto(id) {
  return catalogo.productos.find((p) => p.id === Number(id));
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
  dibujarProductos();
  actualizarBoton();
  if ($('#panel-carrito').classList.contains('abierto')) dibujarCarrito();
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
    ${p.imagenes.length ? `<div class="detalle-fotos">${p.imagenes.map((i) => `<img src="/api/public/imagenes/${i}" alt="">`).join('')}</div>` : ''}
    <p class="suave">${esc(p.marca)}${p.categoria ? ' · ' + esc(p.categoria) : ''}</p>
    ${p.descripcion ? `<p style="white-space:pre-line">${esc(p.descripcion)}</p>` : ''}
    <p class="marca" style="font-size:1.4rem">${cop(p.precio)}</p>
    <div class="modal-pie">${p.disponible > 0 ? `<button class="primario" data-mas="${p.id}" data-cerrar>Agregar al pedido</button>` : '<span class="etiqueta agotado">Agotado</span>'}</div>
  </div>`;
  fondo.addEventListener('click', (e) => { if (e.target === fondo || e.target.closest('[data-cerrar]')) fondo.remove(); });
  document.body.append(fondo);
}

function lineas() {
  return Object.entries(carrito).map(([id, cantidad]) => ({ p: producto(id), cantidad })).filter((l) => l.p);
}

function actualizarBoton() {
  const ls = lineas();
  const unidades = ls.reduce((s, l) => s + l.cantidad, 0);
  $('#abrir-carrito').hidden = unidades === 0;
  $('#cuenta').textContent = unidades;
  $('#total-boton').textContent = cop(ls.reduce((s, l) => s + l.cantidad * l.p.precio, 0));
}

function abrirCarrito(abrir) {
  $('#panel-carrito').classList.toggle('abierto', abrir);
  $('#fondo-panel').hidden = !abrir;
  if (abrir) dibujarCarrito();
}
$('#abrir-carrito').addEventListener('click', () => abrirCarrito(true));
$('#cerrar-carrito').addEventListener('click', () => abrirCarrito(false));
$('#fondo-panel').addEventListener('click', () => abrirCarrito(false));

function dibujarCarrito() {
  const ls = lineas();
  const domicilioCosto = catalogo.negocio.costoDomicilio;
  const entrega = datosCliente.entrega || 'RECOGIDA';
  const subtotal = ls.reduce((s, l) => s + l.cantidad * l.p.precio, 0);
  const domicilio = entrega === 'DOMICILIO' ? domicilioCosto : 0;
  if (!ls.length) {
    $('#cuerpo-carrito').innerHTML = '<p class="vacio">Tu pedido está vacío.</p>';
    return;
  }
  $('#cuerpo-carrito').innerHTML = `
    ${ls.map(({ p, cantidad }) => `<div class="linea">
      ${p.imagenes.length ? `<img src="/api/public/imagenes/${p.imagenes[0]}" alt="">` : '<div class="ph"></div>'}
      <div><strong>${esc(p.nombre)}</strong><br><span class="suave">${cop(p.precio)} c/u</span><br>
        <span class="cantidad"><button data-menos="${p.id}" aria-label="Quitar uno">−</button>${cantidad}<button data-mas="${p.id}" aria-label="Agregar uno">+</button></span></div>
      <strong>${cop(cantidad * p.precio)}</strong></div>`).join('')}
    <form id="form-pedido" style="display:flex;flex-direction:column;gap:.7em">
      <div class="entrega">
        <label><input type="radio" name="entrega" value="RECOGIDA" ${entrega === 'RECOGIDA' ? 'checked' : ''}> Recoger</label>
        <label><input type="radio" name="entrega" value="DOMICILIO" ${entrega === 'DOMICILIO' ? 'checked' : ''}> Domicilio${domicilioCosto ? ' (' + cop(domicilioCosto) + ')' : ''}</label>
      </div>
      <label>Nombre * <input name="nombre" required value="${esc(datosCliente.nombre)}" autocomplete="name"></label>
      <label>Teléfono (WhatsApp) * <input name="telefono" type="tel" required value="${esc(datosCliente.telefono)}" autocomplete="tel"></label>
      ${entrega === 'DOMICILIO' ? `<label>Dirección de entrega * <input name="direccion" required value="${esc(datosCliente.direccion)}" autocomplete="street-address"></label>` : ''}
      <label>Observaciones <textarea name="observaciones" placeholder="Tono, referencia, horario preferido…">${esc(datosCliente.observaciones)}</textarea></label>
      <div class="resumen">
        <span>Productos</span><span>${cop(subtotal)}</span>
        ${domicilio ? `<span>Domicilio</span><span>${cop(domicilio)}</span>` : ''}
        <span class="total">Total</span><span class="total">${cop(subtotal + domicilio)}</span>
      </div>
      <p class="suave" style="margin:0;font-size:.85rem">Puedes pagar por transferencia o Nequi por anticipado, o al recibir/recoger. Coordinaremos la entrega por WhatsApp.</p>
      <button class="boton whatsapp" id="enviar">Enviar pedido por WhatsApp</button>
    </form>`;
  const form = $('#form-pedido');
  form.addEventListener('input', () => {
    datosCliente = { ...datosCliente, nombre: form.nombre.value, telefono: form.telefono.value, direccion: form.direccion?.value ?? datosCliente.direccion, observaciones: form.observaciones.value };
    guardar();
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'entrega') {
      datosCliente.entrega = e.target.value;
      guardar();
      dibujarCarrito();
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
        tipoEntrega: datosCliente.entrega || 'RECOGIDA', direccion: form.direccion?.value || null,
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
    actualizarBoton();
    $('#cuerpo-carrito').innerHTML = `<div class="vacio"><h2>¡Pedido ${esc(respuesta.numero)} enviado! 💖</h2>
      <p>Total ${cop(respuesta.total)}. Si WhatsApp no se abrió, <a href="${esc(respuesta.whatsappUrl)}" target="_blank" rel="noopener">toca aquí</a>.</p>
      <p>Te confirmaremos por WhatsApp.</p></div>`;
    // Recarga existencias
    const nuevo = await fetch('/api/public/catalogo').then((x) => x.json());
    catalogo.productos = nuevo.productos;
    dibujarProductos();
  } catch (error) {
    if (ventana) ventana.close();
    avisar(error.message, 'error');
    boton.disabled = false;
    boton.textContent = 'Enviar pedido por WhatsApp';
  }
}

iniciar();
