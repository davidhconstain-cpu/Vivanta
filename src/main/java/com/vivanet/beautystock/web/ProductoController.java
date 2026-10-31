package com.vivanet.beautystock.web;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.vivanet.beautystock.dto.Dtos.CategoriaDto;
import com.vivanet.beautystock.dto.Dtos.HistorialPrecioDto;
import com.vivanet.beautystock.dto.Dtos.ProductoDto;
import com.vivanet.beautystock.dto.Dtos.ProductoRequest;
import com.vivanet.beautystock.service.ProductoService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
public class ProductoController {

    private final ProductoService servicio;

    public ProductoController(ProductoService servicio) {
        this.servicio = servicio;
    }

    @GetMapping("/categorias")
    public List<CategoriaDto> categorias() {
        return servicio.categorias();
    }

    @PostMapping("/categorias")
    public CategoriaDto crearCategoria(@Valid @RequestBody CategoriaDto datos) {
        return servicio.guardarCategoria(null, datos.nombre());
    }

    @PutMapping("/categorias/{id}")
    public CategoriaDto renombrarCategoria(@PathVariable Long id, @Valid @RequestBody CategoriaDto datos) {
        return servicio.guardarCategoria(id, datos.nombre());
    }

    @GetMapping("/productos")
    public List<ProductoDto> listar(@RequestParam(required = false) String q,
            @RequestParam(required = false) Long categoriaId,
            @RequestParam(defaultValue = "false") boolean soloActivos) {
        return servicio.listar(q, categoriaId, soloActivos);
    }

    @GetMapping("/productos/precio-sugerido")
    public Map<String, Long> precioSugerido(@RequestParam long costo) {
        return Map.of("precio", servicio.precioSugerido(costo));
    }

    @GetMapping("/productos/{id}")
    public ProductoDto consultar(@PathVariable Long id) {
        return servicio.consultar(id);
    }

    @PostMapping("/productos")
    public ProductoDto crear(@Valid @RequestBody ProductoRequest datos) {
        return servicio.crear(datos);
    }

    @PutMapping("/productos/{id}")
    public ProductoDto actualizar(@PathVariable Long id, @Valid @RequestBody ProductoRequest datos) {
        return servicio.actualizar(id, datos);
    }

    @PutMapping("/productos/{id}/activo")
    public ProductoDto cambiarActivo(@PathVariable Long id, @RequestBody Map<String, Boolean> datos) {
        return servicio.cambiarActivo(id, Boolean.TRUE.equals(datos.get("activo")));
    }

    @DeleteMapping("/productos/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        servicio.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/productos/{id}/historial-precios")
    public List<HistorialPrecioDto> historial(@PathVariable Long id) {
        return servicio.historialPrecios(id);
    }

    @PostMapping(path = "/productos/{id}/imagenes", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProductoDto subirImagenes(@PathVariable Long id, @RequestParam("archivos") List<MultipartFile> archivos)
            throws IOException {
        for (MultipartFile archivo : archivos) {
            servicio.agregarImagen(id, archivo);
        }
        return servicio.consultar(id);
    }

    @PutMapping("/imagenes/{id}/principal")
    public ResponseEntity<Void> principal(@PathVariable Long id) {
        servicio.marcarPrincipal(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/imagenes/{id}")
    public ResponseEntity<Void> eliminarImagen(@PathVariable Long id) {
        servicio.eliminarImagen(id);
        return ResponseEntity.noContent().build();
    }

    /** Publica: la usa tambien el catalogo. */
    @GetMapping("/public/imagenes/{id}")
    public ResponseEntity<byte[]> imagen(@PathVariable Long id) {
        var imagen = servicio.imagen(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(imagen.getContentType()))
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(7)).cachePublic())
                .body(imagen.getDatos());
    }
}
