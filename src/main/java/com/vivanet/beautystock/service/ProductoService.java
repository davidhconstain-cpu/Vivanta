package com.vivanet.beautystock.service;

import java.io.IOException;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.vivanet.beautystock.dto.Dtos.CategoriaDto;
import com.vivanet.beautystock.dto.Dtos.HistorialPrecioDto;
import com.vivanet.beautystock.dto.Dtos.ProductoDto;
import com.vivanet.beautystock.dto.Dtos.ProductoRequest;
import com.vivanet.beautystock.entity.Categoria;
import com.vivanet.beautystock.entity.HistorialPrecio;
import com.vivanet.beautystock.entity.Producto;
import com.vivanet.beautystock.entity.ProductoImagen;
import com.vivanet.beautystock.repository.CategoriaRepository;
import com.vivanet.beautystock.repository.HistorialPrecioRepository;
import com.vivanet.beautystock.repository.ProductoImagenRepository;
import com.vivanet.beautystock.repository.ProductoRepository;
import com.vivanet.beautystock.service.InventarioService.Existencias;

@Service
public class ProductoService {

    private final ProductoRepository productos;
    private final CategoriaRepository categorias;
    private final ProductoImagenRepository imagenes;
    private final HistorialPrecioRepository historial;
    private final InventarioService inventario;
    private final ConsecutivoService consecutivos;
    private final ConfiguracionService configuracion;

    public ProductoService(ProductoRepository productos, CategoriaRepository categorias,
            ProductoImagenRepository imagenes, HistorialPrecioRepository historial, InventarioService inventario,
            ConsecutivoService consecutivos, ConfiguracionService configuracion) {
        this.productos = productos;
        this.categorias = categorias;
        this.imagenes = imagenes;
        this.historial = historial;
        this.inventario = inventario;
        this.consecutivos = consecutivos;
        this.configuracion = configuracion;
    }

    /** Precio sugerido = costo + porcentaje global, redondeado al millar mas cercano. */
    @Transactional
    public long precioSugerido(long costo) {
        int porcentaje = configuracion.obtener().getPorcentajeIncremento();
        double precio = costo * (1 + porcentaje / 100.0);
        return Math.round(precio / 1000.0) * 1000;
    }

    // ---------- Categorias ----------

    @Transactional(readOnly = true)
    public List<CategoriaDto> categorias() {
        return categorias.findAllByOrderByNombreAsc().stream()
                .map(c -> new CategoriaDto(c.getId(), c.getNombre()))
                .toList();
    }

    @Transactional
    public CategoriaDto guardarCategoria(Long id, String nombre) {
        Categoria categoria = id == null ? new Categoria() : categorias.findById(id)
                .orElseThrow(() -> new NegocioException("Categoria no encontrada."));
        categoria.setNombre(nombre.trim());
        categoria = categorias.save(categoria);
        return new CategoriaDto(categoria.getId(), categoria.getNombre());
    }

    // ---------- Productos ----------

    /** Lista filtrada por texto (nombre, codigo, marca o categoria) y categoria. */
    @Transactional
    public List<ProductoDto> listar(String texto, Long categoriaId, boolean soloActivos) {
        Map<Long, Existencias> existencias = inventario.existenciasDeTodos();
        Map<Long, List<Long>> imagenesPorProducto = imagenesPorProducto();
        int porcentaje = configuracion.obtener().getPorcentajeIncremento();
        String buscado = normalizar(texto);

        List<ProductoDto> resultado = new ArrayList<>();
        for (Producto p : productos.findAllByOrderByNombreAsc()) {
            if (soloActivos && !p.isActivo()) {
                continue;
            }
            if (categoriaId != null && (p.getCategoria() == null || !p.getCategoria().getId().equals(categoriaId))) {
                continue;
            }
            if (!buscado.isEmpty()) {
                String datos = normalizar(p.getNombre() + " " + p.getCodigo() + " " + p.getMarca() + " "
                        + (p.getCategoria() != null ? p.getCategoria().getNombre() : ""));
                if (!datos.contains(buscado)) {
                    continue;
                }
            }
            resultado.add(aDto(p, existencias.get(p.getId()), imagenesPorProducto.get(p.getId()), porcentaje));
        }
        return resultado;
    }

    @Transactional
    public ProductoDto consultar(Long id) {
        Producto p = buscar(id);
        return aDto(p, inventario.existenciasDeTodos().get(id), imagenesPorProducto().get(id),
                configuracion.obtener().getPorcentajeIncremento());
    }

    @Transactional
    public ProductoDto crear(ProductoRequest datos) {
        validarNoRepetido(datos, null);
        Producto p = new Producto();
        p.setCodigo(consecutivos.siguiente("P"));
        copiar(datos, p);
        p.setPrecioVenta(datos.precioVenta() > 0 ? datos.precioVenta() : precioSugerido(datos.costo()));
        copiarOferta(datos, p);
        productos.save(p);
        return consultar(p.getId());
    }

    @Transactional
    public ProductoDto actualizar(Long id, ProductoRequest datos) {
        validarNoRepetido(datos, id);
        Producto p = buscar(id);
        copiar(datos, p);
        cambiarPrecio(p, datos.precioVenta());
        copiarOferta(datos, p);
        return consultar(id);
    }

    /** Cambia el precio de venta y deja constancia en el historial. */
    @Transactional
    public void cambiarPrecio(Producto p, long nuevoPrecio) {
        if (p.getPrecioVenta() != nuevoPrecio) {
            historial.save(new HistorialPrecio(p, p.getPrecioVenta(), nuevoPrecio));
            p.setPrecioVenta(nuevoPrecio);
        }
    }

    @Transactional
    public ProductoDto cambiarActivo(Long id, boolean activo) {
        buscar(id).setActivo(activo);
        return consultar(id);
    }

    /**
     * Borra un producto creado por error. Solo si esta desactivado y nunca tuvo
     * compras, ventas, pedidos ni movimientos; si los tuvo se deja desactivado.
     */
    @Transactional
    public void eliminar(Long id) {
        Producto p = buscar(id);
        if (p.isActivo()) {
            throw new NegocioException("Primero desactiva el producto.");
        }
        if (productos.usos(id) > 0) {
            throw new NegocioException("El producto " + p.getCodigo()
                    + " tiene compras, ventas o movimientos registrados; no se puede eliminar. Déjalo desactivado.");
        }
        productos.borrarImagenes(id);
        productos.borrarHistorial(id);
        productos.delete(p);
    }

    @Transactional(readOnly = true)
    public List<HistorialPrecioDto> historialPrecios(Long id) {
        return historial.findByProductoIdOrderByFechaDesc(id).stream()
                .map(h -> new HistorialPrecioDto(h.getFecha(), h.getPrecioAnterior(), h.getPrecioNuevo()))
                .toList();
    }

    @Transactional
    public Producto buscar(Long id) {
        return productos.findById(id).orElseThrow(() -> new NegocioException("Producto no encontrado."));
    }

    // ---------- Imagenes ----------

    @Transactional
    public void agregarImagen(Long productoId, MultipartFile archivo) throws IOException {
        String tipo = archivo.getContentType();
        if (tipo == null || !tipo.startsWith("image/")) {
            throw new NegocioException("El archivo debe ser una imagen.");
        }
        Producto producto = buscar(productoId);
        ProductoImagen imagen = new ProductoImagen();
        imagen.setProducto(producto);
        imagen.setContentType(tipo);
        imagen.setDatos(archivo.getBytes());
        imagen.setPrincipal(imagenes.contarPorProducto(productoId) == 0);
        imagenes.save(imagen);
    }

    @Transactional
    public void marcarPrincipal(Long imagenId) {
        ProductoImagen imagen = imagenes.findById(imagenId)
                .orElseThrow(() -> new NegocioException("Imagen no encontrada."));
        imagenes.marcarPrincipal(imagen.getProducto().getId(), imagenId);
    }

    @Transactional
    public void eliminarImagen(Long imagenId) {
        ProductoImagen imagen = imagenes.findById(imagenId)
                .orElseThrow(() -> new NegocioException("Imagen no encontrada."));
        Long productoId = imagen.getProducto().getId();
        boolean eraPrincipal = imagen.isPrincipal();
        imagenes.delete(imagen);
        imagenes.flush();
        if (eraPrincipal) {
            Long otra = imagenes.primeraDelProducto(productoId);
            if (otra != null) {
                imagenes.marcarPrincipal(productoId, otra);
            }
        }
    }

    @Transactional(readOnly = true)
    public ProductoImagen imagen(Long imagenId) {
        ProductoImagen imagen = imagenes.findById(imagenId)
                .orElseThrow(() -> new NegocioException("Imagen no encontrada."));
        imagen.getDatos();
        return imagen;
    }

    /** Ids de imagenes por producto, la principal primero. */
    @Transactional(readOnly = true)
    public Map<Long, List<Long>> imagenesPorProducto() {
        Map<Long, List<Long>> mapa = new HashMap<>();
        for (Object[] fila : imagenes.resumen()) {
            mapa.computeIfAbsent((Long) fila[1], k -> new ArrayList<>()).add((Long) fila[0]);
        }
        return mapa;
    }

    // ---------- Auxiliares ----------

    /** No permite dos productos con el mismo nombre y marca (sin importar tildes, mayusculas ni espacios). */
    private void validarNoRepetido(ProductoRequest datos, Long id) {
        String clave = clave(datos.nombre(), datos.marca());
        for (Producto otro : productos.findAll()) {
            if (!otro.getId().equals(id) && clave(otro.getNombre(), otro.getMarca()).equals(clave)) {
                throw new NegocioException("Ya existe el producto " + otro.getCodigo() + " «" + otro.getNombre()
                        + "» de " + otro.getMarca() + (otro.isActivo() ? "" : " (desactivado: puedes activarlo de nuevo)")
                        + ". Búscalo en Inventario en lugar de crearlo otra vez.");
            }
        }
    }

    private static String clave(String nombre, String marca) {
        return normalizar(nombre).replaceAll("\\s+", " ") + "|" + normalizar(marca).replaceAll("\\s+", " ");
    }

    private void copiar(ProductoRequest datos, Producto p) {
        p.setNombre(datos.nombre().trim());
        p.setMarca(datos.marca().trim());
        p.setDescripcion(datos.descripcion());
        p.setCosto(datos.costo());
        p.setStockMinimo(datos.stockMinimo());
        p.setCategoria(datos.categoriaId() == null ? null : categorias.findById(datos.categoriaId())
                .orElseThrow(() -> new NegocioException("Categoria no encontrada.")));
    }

    /** Oferta opcional. Se valida despues de fijar el precio normal. */
    private void copiarOferta(ProductoRequest datos, Producto p) {
        Long oferta = datos.precioOferta();
        if (oferta == null || oferta == 0) {
            p.setPrecioOferta(null);
            p.setOfertaDesde(null);
            p.setOfertaHasta(null);
            return;
        }
        if (oferta >= p.getPrecioVenta()) {
            throw new NegocioException("El precio de oferta debe ser menor al precio de venta ("
                    + Pesos.formato(p.getPrecioVenta()) + ").");
        }
        if (datos.ofertaDesde() != null && datos.ofertaHasta() != null
                && datos.ofertaHasta().isBefore(datos.ofertaDesde())) {
            throw new NegocioException("La fecha final de la oferta no puede ser anterior a la inicial.");
        }
        p.setPrecioOferta(oferta);
        p.setOfertaDesde(datos.ofertaDesde());
        p.setOfertaHasta(datos.ofertaHasta());
    }

    private ProductoDto aDto(Producto p, Existencias e, List<Long> imgs, int porcentaje) {
        if (e == null) {
            e = new Existencias(0, 0, 0);
        }
        long sugerido = Math.round(p.getCosto() * (1 + porcentaje / 100.0) / 1000.0) * 1000;
        return new ProductoDto(p.getId(), p.getCodigo(), p.getNombre(), p.getMarca(),
                p.getCategoria() != null ? p.getCategoria().getId() : null,
                p.getCategoria() != null ? p.getCategoria().getNombre() : null,
                p.getDescripcion(), p.getCosto(), p.getPrecioVenta(), sugerido, p.getStockMinimo(), p.isActivo(),
                e.fisicas(), e.reservadas(), e.disponibles(), p.isActivo() && e.fisicas() <= p.getStockMinimo(),
                imgs != null ? imgs : List.of(),
                p.getPrecioOferta(), p.getOfertaDesde(), p.getOfertaHasta(),
                p.ofertaActiva(LocalDate.now()), p.precioActual(LocalDate.now()));
    }

    /** Minusculas y sin tildes, para que "esika" encuentre "Ésika". */
    static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        return Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .trim();
    }
}
