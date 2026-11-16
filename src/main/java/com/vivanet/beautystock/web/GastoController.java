package com.vivanet.beautystock.web;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.vivanet.beautystock.dto.Dtos.GastoDto;
import com.vivanet.beautystock.dto.Dtos.GastoRecurrenteDto;
import com.vivanet.beautystock.dto.Dtos.GastoRecurrenteRequest;
import com.vivanet.beautystock.dto.Dtos.GastoRequest;
import com.vivanet.beautystock.dto.Dtos.GastosDto;
import com.vivanet.beautystock.dto.Dtos.PagarGastoRequest;
import com.vivanet.beautystock.dto.Dtos.RetiroDto;
import com.vivanet.beautystock.dto.Dtos.RetiroRequest;
import com.vivanet.beautystock.service.GastoService;

import jakarta.validation.Valid;

/** Gastos, retiros y gastos recurrentes (solo para el administrador, como todo /api). */
@RestController
public class GastoController {

    private final GastoService servicio;

    public GastoController(GastoService servicio) {
        this.servicio = servicio;
    }

    @GetMapping("/api/gastos")
    public GastosDto vista(@RequestParam @DateTimeFormat(iso = ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = ISO.DATE) LocalDate hasta) {
        return servicio.vista(desde, hasta);
    }

    @PostMapping("/api/gastos")
    public GastoDto crearGasto(@Valid @RequestBody GastoRequest datos) {
        return servicio.crearGasto(datos);
    }

    @PutMapping("/api/gastos/{id}")
    public GastoDto actualizarGasto(@PathVariable Long id, @Valid @RequestBody GastoRequest datos) {
        return servicio.actualizarGasto(id, datos);
    }

    @PostMapping("/api/gastos/{id}/pagar")
    public GastoDto pagar(@PathVariable Long id, @Valid @RequestBody PagarGastoRequest datos) {
        return servicio.pagar(id, datos);
    }

    @DeleteMapping("/api/gastos/{id}")
    public ResponseEntity<Void> eliminarGasto(@PathVariable Long id) {
        servicio.eliminarGasto(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/retiros")
    public RetiroDto crearRetiro(@Valid @RequestBody RetiroRequest datos) {
        return servicio.crearRetiro(datos);
    }

    @PutMapping("/api/retiros/{id}")
    public RetiroDto actualizarRetiro(@PathVariable Long id, @Valid @RequestBody RetiroRequest datos) {
        return servicio.actualizarRetiro(id, datos);
    }

    @DeleteMapping("/api/retiros/{id}")
    public ResponseEntity<Void> eliminarRetiro(@PathVariable Long id) {
        servicio.eliminarRetiro(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/gastos-recurrentes")
    public GastoRecurrenteDto crearRecurrente(@Valid @RequestBody GastoRecurrenteRequest datos) {
        return servicio.crearRecurrente(datos);
    }

    @PutMapping("/api/gastos-recurrentes/{id}")
    public GastoRecurrenteDto actualizarRecurrente(@PathVariable Long id, @Valid @RequestBody GastoRecurrenteRequest datos) {
        return servicio.actualizarRecurrente(id, datos);
    }

    @DeleteMapping("/api/gastos-recurrentes/{id}")
    public ResponseEntity<Void> eliminarRecurrente(@PathVariable Long id) {
        servicio.eliminarRecurrente(id);
        return ResponseEntity.noContent().build();
    }
}
