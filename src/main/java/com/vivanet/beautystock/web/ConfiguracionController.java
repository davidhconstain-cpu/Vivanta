package com.vivanet.beautystock.web;

import java.io.IOException;
import java.security.Principal;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.vivanet.beautystock.dto.Dtos.ConfiguracionDto;
import com.vivanet.beautystock.dto.Dtos.PanelDto;
import com.vivanet.beautystock.entity.Configuracion;
import com.vivanet.beautystock.service.ConfiguracionService;
import com.vivanet.beautystock.service.ConsecutivoService;
import com.vivanet.beautystock.service.NegocioException;
import com.vivanet.beautystock.service.PanelService;

import jakarta.validation.Valid;

@RestController
public class ConfiguracionController {

    private final ConfiguracionService servicio;
    private final PanelService panel;
    private final ConsecutivoService consecutivos;

    public ConfiguracionController(ConfiguracionService servicio, PanelService panel,
            ConsecutivoService consecutivos) {
        this.servicio = servicio;
        this.panel = panel;
        this.consecutivos = consecutivos;
    }

    @GetMapping("/api/sesion")
    public Map<String, String> sesion(Principal usuario) {
        return Map.of("usuario", usuario.getName());
    }

    /** Proximo numero de venta (V) o compra (C), para mostrarlo en el encabezado del formulario. */
    @GetMapping("/api/consecutivos/{prefijo}")
    public Map<String, String> proximo(@PathVariable String prefijo) {
        if (!prefijo.equals("V") && !prefijo.equals("C")) {
            throw new NegocioException("Prefijo no valido.");
        }
        return Map.of("numero", consecutivos.proximo(prefijo));
    }

    @GetMapping("/api/panel")
    public PanelDto panel() {
        return panel.panel();
    }

    @GetMapping("/api/configuracion")
    public ConfiguracionDto consultar() {
        return servicio.consultar();
    }

    @PutMapping("/api/configuracion")
    public ConfiguracionDto guardar(@Valid @RequestBody ConfiguracionDto datos) {
        return servicio.guardar(datos);
    }

    @PostMapping(path = "/api/configuracion/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Void> logo(@RequestParam("archivo") MultipartFile archivo) throws IOException {
        servicio.guardarLogo(archivo);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/public/logo")
    public ResponseEntity<byte[]> verLogo() {
        Configuracion c = servicio.obtener();
        if (c.getLogo() == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(c.getLogoContentType())).body(c.getLogo());
    }
}
