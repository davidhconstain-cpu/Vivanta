package com.vivanet.beautystock.service;

import java.io.IOException;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.vivanet.beautystock.dto.Dtos.CategoriaDestacadaDto;
import com.vivanet.beautystock.dto.Dtos.CategoriaDto;
import com.vivanet.beautystock.dto.Dtos.ProductoCatalogoDto;
import com.vivanet.beautystock.dto.Dtos.PromocionDto;
import com.vivanet.beautystock.dto.Dtos.PromocionPublicaDto;
import com.vivanet.beautystock.entity.Categoria;
import com.vivanet.beautystock.entity.ImagenCatalogo;
import com.vivanet.beautystock.entity.Promocion;
import com.vivanet.beautystock.repository.CategoriaRepository;
import com.vivanet.beautystock.repository.ImagenCatalogoRepository;
import com.vivanet.beautystock.repository.PromocionRepository;

/**
 * Contenido de la portada del catalogo que se maneja desde Configuracion:
 * el carrusel de promociones y las categorias destacadas ("mas buscadas").
 */
@Service
public class ContenidoCatalogoService {

    /** Cuantas categorias caben en "Nuestras categorias mas buscadas". */
    public static final int MAXIMO_DESTACADAS = 3;

    private final PromocionRepository promociones;
    private final CategoriaRepository categorias;
    private final ImagenCatalogoRepository imagenes;

    public ContenidoCatalogoService(PromocionRepository promociones, CategoriaRepository categorias,
            ImagenCatalogoRepository imagenes) {
        this.promociones = promociones;
        this.categorias = categorias;
        this.imagenes = imagenes;
    }

    // ---------- Promociones ----------

    @Transactional(readOnly = true)
    public List<PromocionDto> listarPromociones() {
        return promociones.findAllByOrderByOrdenAscIdAsc().stream().map(this::aDto).toList();
    }

    @Transactional
    public PromocionDto guardarPromocion(Long id, PromocionDto datos) {
        Promocion p = id == null ? new Promocion() : buscarPromocion(id);
        p.setOrden(datos.orden());
        p.setMarca(CompraService.textoOpcional(datos.marca()));
        p.setTitulo(datos.titulo().trim());
        p.setTexto(CompraService.textoOpcional(datos.texto()));
        p.setProductoId(datos.productoId());
        p.setActiva(datos.activa());
        return aDto(promociones.save(p));
    }

    @Transactional
    public void eliminarPromocion(Long id) {
        Promocion p = buscarPromocion(id);
        borrarImagen(p.getImagenId());
        promociones.delete(p);
    }

    @Transactional
    public PromocionDto imagenPromocion(Long id, MultipartFile archivo) throws IOException {
        Promocion p = buscarPromocion(id);
        p.setImagenId(reemplazarImagen(p.getImagenId(), archivo));
        return aDto(p);
    }

    @Transactional(readOnly = true)
    public List<PromocionPublicaDto> promocionesPublicas() {
        return promociones.findByActivaTrueOrderByOrdenAscIdAsc().stream()
                .map(p -> new PromocionPublicaDto(p.getMarca(), p.getTitulo(), p.getTexto(), p.getProductoId(),
                        url(p.getImagenId())))
                .toList();
    }

    // ---------- Categorias destacadas ----------

    @Transactional
    public CategoriaDto destacarCategoria(Long id, boolean destacada) {
        Categoria c = buscarCategoria(id);
        if (destacada && !c.isDestacada()
                && categorias.findAll().stream().filter(Categoria::isDestacada).count() >= MAXIMO_DESTACADAS) {
            throw new NegocioException("Ya hay " + MAXIMO_DESTACADAS
                    + " categorías destacadas. Quita una antes de destacar otra.");
        }
        c.setDestacada(destacada);
        return aDto(c);
    }

    @Transactional
    public CategoriaDto imagenCategoria(Long id, MultipartFile archivo) throws IOException {
        Categoria c = buscarCategoria(id);
        c.setImagenId(reemplazarImagen(c.getImagenId(), archivo));
        return aDto(c);
    }

    @Transactional
    public CategoriaDto quitarImagenCategoria(Long id) {
        Categoria c = buscarCategoria(id);
        borrarImagen(c.getImagenId());
        c.setImagenId(null);
        return aDto(c);
    }

    /**
     * Tarjetas de "mas buscadas". Sin foto propia, se usa la foto del primer producto
     * de esa categoria que tenga foto.
     */
    @Transactional(readOnly = true)
    public List<CategoriaDestacadaDto> categoriasDestacadas(List<ProductoCatalogoDto> productos) {
        return categorias.findAllByOrderByNombreAsc().stream()
                .filter(Categoria::isDestacada)
                .map(c -> {
                    String imagen = url(c.getImagenId());
                    if (imagen == null) {
                        imagen = productos.stream()
                                .filter(p -> c.getNombre().equals(p.categoria()) && !p.imagenes().isEmpty())
                                .map(p -> "/api/public/imagenes/" + p.imagenes().get(0))
                                .findFirst().orElse(null);
                    }
                    return new CategoriaDestacadaDto(c.getNombre(), imagen);
                })
                .toList();
    }

    // ---------- Imagenes ----------

    @Transactional(readOnly = true)
    public ImagenCatalogo imagen(Long id) {
        ImagenCatalogo imagen = imagenes.findById(id).orElseThrow(() -> new NegocioException("Imagen no encontrada."));
        imagen.getDatos();
        return imagen;
    }

    /** Guarda la imagen nueva y borra la anterior; devuelve el id nuevo. */
    private Long reemplazarImagen(Long anterior, MultipartFile archivo) throws IOException {
        String tipo = archivo.getContentType();
        if (tipo == null || !tipo.startsWith("image/")) {
            throw new NegocioException("El archivo debe ser una imagen.");
        }
        Long nuevo = imagenes.save(new ImagenCatalogo(tipo, archivo.getBytes())).getId();
        borrarImagen(anterior);
        return nuevo;
    }

    private void borrarImagen(Long id) {
        if (id != null) {
            imagenes.deleteById(id);
        }
    }

    /** Cada imagen nueva tiene un id nuevo, asi que su direccion se puede guardar en cache mucho tiempo. */
    private static String url(Long imagenId) {
        return imagenId == null ? null : "/api/public/catalogo-imagenes/" + imagenId;
    }

    private Promocion buscarPromocion(Long id) {
        return promociones.findById(id).orElseThrow(() -> new NegocioException("Promoción no encontrada."));
    }

    private Categoria buscarCategoria(Long id) {
        return categorias.findById(id).orElseThrow(() -> new NegocioException("Categoria no encontrada."));
    }

    private PromocionDto aDto(Promocion p) {
        return new PromocionDto(p.getId(), p.getOrden(), p.getMarca(), p.getTitulo(), p.getTexto(),
                p.getProductoId(), p.isActiva(), p.getImagenId());
    }

    private static CategoriaDto aDto(Categoria c) {
        return new CategoriaDto(c.getId(), c.getNombre(), c.isDestacada(), c.getImagenId());
    }
}
