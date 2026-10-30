package com.vivanet.beautystock.web;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.vivanet.beautystock.dto.Dtos.AnularRequest;
import com.vivanet.beautystock.dto.Dtos.PagoRequest;
import com.vivanet.beautystock.dto.Dtos.VentaDto;
import com.vivanet.beautystock.dto.Dtos.VentaRequest;
import com.vivanet.beautystock.service.VentaService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/ventas")
public class VentaController {

    private final VentaService servicio;

    public VentaController(VentaService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public List<VentaDto> listar(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(defaultValue = "false") boolean pendientes) {
        return servicio.listar(desde, hasta, pendientes);
    }

    @GetMapping("/{id}")
    public VentaDto consultar(@PathVariable Long id) {
        return servicio.consultar(id);
    }

    @PostMapping
    public VentaDto registrar(@Valid @RequestBody VentaRequest datos) {
        return servicio.registrar(datos);
    }

    @PostMapping("/{id}/pagos")
    public VentaDto abonar(@PathVariable Long id, @Valid @RequestBody PagoRequest pago) {
        return servicio.abonar(id, pago);
    }

    @PostMapping("/{id}/anular")
    public VentaDto anular(@PathVariable Long id, @Valid @RequestBody AnularRequest datos) {
        return servicio.anular(id, datos.motivo());
    }
}
