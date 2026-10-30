package com.vivanet.beautystock.web;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.vivanet.beautystock.dto.Dtos.AjusteRequest;
import com.vivanet.beautystock.dto.Dtos.LoteDto;
import com.vivanet.beautystock.dto.Dtos.MovimientoDto;
import com.vivanet.beautystock.service.InventarioService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/inventario")
public class InventarioController {

    private final InventarioService servicio;

    public InventarioController(InventarioService servicio) {
        this.servicio = servicio;
    }

    @GetMapping("/{productoId}/lotes")
    public List<LoteDto> lotes(@PathVariable Long productoId) {
        return servicio.lotesDe(productoId);
    }

    @GetMapping("/movimientos")
    public List<MovimientoDto> movimientos(@RequestParam(required = false) Long productoId) {
        return servicio.movimientos(productoId);
    }

    @PostMapping("/ajustes")
    public ResponseEntity<Void> ajustar(@Valid @RequestBody AjusteRequest ajuste) {
        servicio.ajustar(ajuste);
        return ResponseEntity.noContent().build();
    }
}
