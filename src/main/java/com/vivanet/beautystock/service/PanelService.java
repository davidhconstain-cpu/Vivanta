package com.vivanet.beautystock.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.vivanet.beautystock.dto.Dtos.AlertaDto;
import com.vivanet.beautystock.dto.Dtos.CatalogoDto;
import com.vivanet.beautystock.dto.Dtos.PanelDto;
import com.vivanet.beautystock.dto.Dtos.ProductoCatalogoDto;
import com.vivanet.beautystock.dto.Dtos.ProductoDto;
import com.vivanet.beautystock.entity.Compra;
import com.vivanet.beautystock.entity.Configuracion;
import com.vivanet.beautystock.entity.EstadoPedido;
import com.vivanet.beautystock.entity.EstadoVenta;
import com.vivanet.beautystock.entity.Venta;
import com.vivanet.beautystock.repository.CompraRepository;
import com.vivanet.beautystock.repository.PedidoRepository;
import com.vivanet.beautystock.repository.VentaRepository;
import com.vivanet.beautystock.service.InventarioService.Existencias;

/** Resumen del panel principal y datos del catalogo publico. */
@Service
public class PanelService {

    private final VentaRepository ventas;
    private final CompraRepository compras;
    private final PedidoRepository pedidos;
    private final InventarioService inventario;
    private final ProductoService productos;
    private final ConfiguracionService configuracion;

    public PanelService(VentaRepository ventas, CompraRepository compras, PedidoRepository pedidos,
            InventarioService inventario, ProductoService productos, ConfiguracionService configuracion) {
        this.ventas = ventas;
        this.compras = compras;
        this.pedidos = pedidos;
        this.inventario = inventario;
        this.productos = productos;
        this.configuracion = configuracion;
    }

    @Transactional
    public PanelDto panel() {
        LocalDate hoy = LocalDate.now();
        List<Venta> deHoy = activas(ventas.entreFechas(hoy.atStartOfDay(), hoy.plusDays(1).atStartOfDay()));
        List<Venta> delMes = activas(ventas.entreFechas(hoy.withDayOfMonth(1).atStartOfDay(),
                hoy.plusDays(1).atStartOfDay()));

        List<Venta> porCobrar = ventas.pendientesDeCobro();
        List<Compra> porPagar = compras.pendientesDePago();

        long unidades = 0;
        long valor = 0;
        for (Existencias e : inventario.existenciasDeTodos().values()) {
            unidades += e.fisicas();
            valor += e.valor();
        }

        List<AlertaDto> alertas = new ArrayList<>();
        for (ProductoDto p : productos.listar(null, null, true)) {
            if (p.existencias() == 0) {
                alertas.add(new AlertaDto("agotado", p.nombre() + " está agotado.", "inventario"));
            } else if (p.stockBajo()) {
                alertas.add(new AlertaDto("stock", p.nombre() + ": quedan " + p.existencias()
                        + " (mínimo " + p.stockMinimo() + ").", "inventario"));
            }
        }
        for (Venta v : porCobrar) {
            String quien = v.getCliente() != null ? v.getCliente().getNombre() : "Cliente";
            agregarVencimiento(alertas, v.getFechaVencimiento(), hoy,
                    quien + " — " + v.getNumero() + " (saldo " + Pesos.formato(v.getSaldo()) + ")", "ventas");
        }
        for (Compra c : porPagar) {
            String quien = c.getProveedor() != null ? c.getProveedor() : "Proveedor";
            agregarVencimiento(alertas, c.getFechaVencimiento(), hoy,
                    "Pago a " + quien + " — " + c.getNumero() + " (saldo " + Pesos.formato(c.getSaldo()) + ")", "compras");
        }
        long pendientes = pedidos.countByEstado(EstadoPedido.PENDIENTE);
        if (pendientes > 0) {
            alertas.add(0, new AlertaDto("pedido", pendientes + " pedido(s) del catálogo por confirmar.", "pedidos"));
        }

        return new PanelDto(
                deHoy.stream().mapToLong(Venta::getTotal).sum(),
                deHoy.stream().mapToLong(Venta::getUtilidad).sum(),
                deHoy.size(),
                delMes.stream().mapToLong(Venta::getTotal).sum(),
                delMes.stream().mapToLong(Venta::getUtilidad).sum(),
                porCobrar.stream().mapToLong(Venta::getSaldo).sum(),
                porPagar.stream().mapToLong(Compra::getSaldo).sum(),
                unidades, valor, pendientes, alertas);
    }

    /** Productos para el catalogo publico (solo activos; agotados segun la configuracion). */
    @Transactional
    public CatalogoDto catalogo() {
        Configuracion config = configuracion.obtener();
        if (!config.isCatalogoHabilitado()) {
            return new CatalogoDto(false, configuracion.negocioPublico(), List.of());
        }
        Map<Long, List<Long>> imagenes = productos.imagenesPorProducto();
        List<ProductoCatalogoDto> lista = productos.listar(null, null, true).stream()
                .filter(p -> config.isMostrarAgotados() || p.disponible() > 0)
                .map(p -> new ProductoCatalogoDto(p.id(), p.nombre(), p.marca(), p.categoriaNombre(),
                        p.descripcion(), p.precioVenta(), (int) p.disponible(),
                        imagenes.getOrDefault(p.id(), List.of())))
                .toList();
        return new CatalogoDto(true, configuracion.negocioPublico(), lista);
    }

    /** Aviso tres dias antes del vencimiento y cuando ya esta vencido. */
    private static void agregarVencimiento(List<AlertaDto> alertas, LocalDate vence, LocalDate hoy, String texto,
            String vista) {
        if (vence == null) {
            return;
        }
        if (vence.isBefore(hoy)) {
            alertas.add(new AlertaDto("vencido", "Vencido: " + texto, vista));
        } else if (!vence.isAfter(hoy.plusDays(3))) {
            alertas.add(new AlertaDto("por-vencer", "Vence el " + vence.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")) + ": " + texto, vista));
        }
    }

    private static List<Venta> activas(List<Venta> lista) {
        return lista.stream().filter(v -> v.getEstado() == EstadoVenta.ACTIVA).toList();
    }
}
