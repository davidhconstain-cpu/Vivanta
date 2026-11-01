package com.vivanet.beautystock.web;

import java.io.IOException;
import java.time.Duration;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.vivanet.beautystock.dto.Dtos.CategoriaDto;
import com.vivanet.beautystock.dto.Dtos.PromocionDto;
import com.vivanet.beautystock.service.ContenidoCatalogoService;

import jakarta.validation.Valid;

/** Carrusel de promociones y categorias destacadas del catalogo (se manejan en Configuracion). */
@RestController
public class ContenidoCatalogoController {

    private final ContenidoCatalogoService servicio;

    public ContenidoCatalogoController(ContenidoCatalogoService servicio) {
        this.servicio = servicio;
    }

    @GetMapping("/api/promociones")
    public List<PromocionDto> promociones() {
        return servicio.listarPromociones();
    }

    @PostMapping("/api/promociones")
    public PromocionDto crear(@Valid @RequestBody PromocionDto datos) {
        return servicio.guardarPromocion(null, datos);
    }

    @PutMapping("/api/promociones/{id}")
    public PromocionDto actualizar(@PathVariable Long id, @Valid @RequestBody PromocionDto datos) {
        return servicio.guardarPromocion(id, datos);
    }

    @DeleteMapping("/api/promociones/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        servicio.eliminarPromocion(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(path = "/api/promociones/{id}/imagen", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PromocionDto imagenPromocion(@PathVariable Long id, @RequestParam("archivo") MultipartFile archivo)
            throws IOException {
        return servicio.imagenPromocion(id, archivo);
    }

    @PutMapping("/api/categorias/{id}/destacada")
    public CategoriaDto destacar(@PathVariable Long id, @RequestBody Map<String, Boolean> datos) {
        return servicio.destacarCategoria(id, Boolean.TRUE.equals(datos.get("destacada")));
    }

    @PostMapping(path = "/api/categorias/{id}/imagen", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CategoriaDto imagenCategoria(@PathVariable Long id, @RequestParam("archivo") MultipartFile archivo)
            throws IOException {
        return servicio.imagenCategoria(id, archivo);
    }

    @DeleteMapping("/api/categorias/{id}/imagen")
    public CategoriaDto quitarImagenCategoria(@PathVariable Long id) {
        return servicio.quitarImagenCategoria(id);
    }

    /** Publica: la usa el catalogo. Una imagen nunca cambia (al reemplazarla cambia el id). */
    @GetMapping("/api/public/catalogo-imagenes/{id}")
    public ResponseEntity<byte[]> imagen(@PathVariable Long id) {
        var imagen = servicio.imagen(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(imagen.getContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                .body(imagen.getDatos());
    }
}
