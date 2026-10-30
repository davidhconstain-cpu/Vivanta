package com.vivanet.beautystock.web;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.vivanet.beautystock.dto.Dtos.CatalogoDto;
import com.vivanet.beautystock.dto.Dtos.EstadoPedidoRequest;
import com.vivanet.beautystock.dto.Dtos.PedidoCreadoDto;
import com.vivanet.beautystock.dto.Dtos.PedidoDto;
import com.vivanet.beautystock.dto.Dtos.PedidoRequest;
import com.vivanet.beautystock.service.PanelService;
import com.vivanet.beautystock.service.PedidoService;

import jakarta.validation.Valid;

@RestController
public class PedidoController {

    private final PedidoService servicio;
    private final PanelService panel;

    public PedidoController(PedidoService servicio, PanelService panel) {
        this.servicio = servicio;
        this.panel = panel;
    }

    // ----- Publico (catalogo) -----

    @GetMapping("/api/public/catalogo")
    public CatalogoDto catalogo() {
        return panel.catalogo();
    }

    @PostMapping("/api/public/pedidos")
    public PedidoCreadoDto crear(@Valid @RequestBody PedidoRequest datos) {
        return servicio.crear(datos);
    }

    // ----- Administrador -----

    @GetMapping("/api/pedidos")
    public List<PedidoDto> listar() {
        return servicio.listar();
    }

    @GetMapping("/api/pedidos/{id}")
    public PedidoDto consultar(@PathVariable Long id) {
        return servicio.consultar(id);
    }

    @PostMapping("/api/pedidos/{id}/estado")
    public PedidoDto cambiarEstado(@PathVariable Long id, @Valid @RequestBody EstadoPedidoRequest datos) {
        return servicio.cambiarEstado(id, datos.estado());
    }
}
