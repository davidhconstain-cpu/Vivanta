package com.vivanet.beautystock.web;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.vivanet.beautystock.dto.Dtos.ClienteDetalleDto;
import com.vivanet.beautystock.dto.Dtos.ClienteDto;
import com.vivanet.beautystock.dto.Dtos.ClienteRequest;
import com.vivanet.beautystock.dto.Dtos.PagoRequest;
import com.vivanet.beautystock.service.ClienteService;
import com.vivanet.beautystock.service.VentaService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/clientes")
public class ClienteController {

    private final ClienteService servicio;
    private final VentaService ventas;

    public ClienteController(ClienteService servicio, VentaService ventas) {
        this.servicio = servicio;
        this.ventas = ventas;
    }

    @GetMapping
    public List<ClienteDto> listar(@RequestParam(required = false) String q) {
        return servicio.listar(q);
    }

    @GetMapping("/{id}")
    public ClienteDetalleDto detalle(@PathVariable Long id) {
        return servicio.detalle(id);
    }

    @PostMapping
    public ClienteDto crear(@Valid @RequestBody ClienteRequest datos) {
        return servicio.crear(datos);
    }

    @PutMapping("/{id}")
    public ClienteDto actualizar(@PathVariable Long id, @Valid @RequestBody ClienteRequest datos) {
        return servicio.actualizar(id, datos);
    }

    /** Abono directo desde el cliente; se reparte entre sus deudas mas antiguas. */
    @PostMapping("/{id}/abonos")
    public Map<String, String> abonar(@PathVariable Long id, @Valid @RequestBody PagoRequest pago) {
        return Map.of("numero", ventas.abonarCliente(id, pago));
    }
}
