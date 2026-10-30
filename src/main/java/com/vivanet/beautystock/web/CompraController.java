package com.vivanet.beautystock.web;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.vivanet.beautystock.dto.Dtos.CompraDto;
import com.vivanet.beautystock.dto.Dtos.CompraRequest;
import com.vivanet.beautystock.dto.Dtos.PagoRequest;
import com.vivanet.beautystock.service.CompraService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/compras")
public class CompraController {

    private final CompraService servicio;

    public CompraController(CompraService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public List<CompraDto> listar(@RequestParam(defaultValue = "false") boolean pendientes) {
        return servicio.listar(pendientes);
    }

    @GetMapping("/{id}")
    public CompraDto consultar(@PathVariable Long id) {
        return servicio.consultar(id);
    }

    @PostMapping
    public CompraDto registrar(@Valid @RequestBody CompraRequest datos) {
        return servicio.registrar(datos);
    }

    @PostMapping("/{id}/pagos")
    public CompraDto abonar(@PathVariable Long id, @Valid @RequestBody PagoRequest pago) {
        return servicio.abonar(id, pago);
    }
}
