package com.vivanet.beautystock.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.vivanet.beautystock.dto.Dtos.AlertaDto;
import com.vivanet.beautystock.dto.Dtos.CatalogoDto;
import com.vivanet.beautystock.dto.Dtos.PanelDto;
import com.vivanet.beautystock.dto.Dtos.ProductoCatalogoDto;
import com.vivanet.beautystock.dto.Dtos.ProductoDelSetDto;
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
        List<ProductoDto> activos = productos.listar(null, null, true);
        for (ProductoDto p : activos) {
            if (p.combo()) {
                continue; // los sets dependen de sus productos, que ya tienen sus propias alertas
            }
            if (p.existencias() == 0) {
                alertas.add(new AlertaDto("agotado", p.nombre(), "Sin existencias", "Agotado", "inventario"));
            } else if (p.stockBajo()) {
                alertas.add(new AlertaDto("stock", p.nombre(), "Quedan " + p.existencias() + " unidades · mínimo "
                        + p.stockMinimo(), "Stock bajo", "inventario"));
            }
        }
        List<ProductoDto> enOferta = activos.stream().filter(ProductoDto::ofertaActiva).toList();
        if (!enOferta.isEmpty()) {
            long terminan = enOferta.stream()
                    .filter(p -> p.ofertaHasta() != null && !p.ofertaHasta().isAfter(hoy.plusDays(1))).count();
            alertas.add(new AlertaDto("oferta", enOferta.size() + " oferta(s) activa(s) en el catálogo",
                    terminan > 0 ? terminan + " termina(n) hoy o mañana" : "Se muestran con el precio anterior tachado",
                    "Oferta", "inventario"));
        }
        for (Venta v : porCobrar) {
            String quien = v.getCliente() != null ? v.getCliente().getNombre() : "Cliente";
            agregarVencimiento(alertas, v.getFechaVencimiento(), hoy,
                    quien + " debe " + Pesos.formato(v.getSaldo()), "Venta " + v.getNumero(), "ventas");
        }
        for (Compra c : porPagar) {
            agregarVencimiento(alertas, c.getFechaVencimiento(), hoy, "Pago a proveedor " + c.getNumero(),
                    "Saldo " + Pesos.formato(c.getSaldo()) + (c.getProveedor() != null ? " · " + c.getProveedor() : ""),
                    "compras");
        }
        long pendientes = pedidos.countByEstado(EstadoPedido.PENDIENTE);
        if (pendientes > 0) {
            alertas.add(0, new AlertaDto("pedido", pendientes + " pedido(s) del catálogo por confirmar",
                    "Las unidades quedan reservadas hasta que confirmes o canceles", "Nuevo", "pedidos"));
        }
        Configuracion config = configuracion.obtener();
        boolean whatsappConfigurado = config.getWhatsapp() != null && !config.getWhatsapp().isBlank();
        if (!whatsappConfigurado) {
            alertas.add(0, new AlertaDto("vencido", "Falta el número de WhatsApp",
                    "El catálogo no puede recibir pedidos. Configúralo aquí.", "Pendiente", "configuracion"));
        }
        long clientesConSaldo = porCobrar.stream().filter(v -> v.getCliente() != null)
                .map(v -> v.getCliente().getId()).distinct().count();

        return new PanelDto(
                deHoy.stream().mapToLong(Venta::getTotal).sum(),
                deHoy.stream().mapToLong(Venta::getUtilidad).sum(),
                deHoy.size(),
                delMes.stream().mapToLong(Venta::getTotal).sum(),
                delMes.stream().mapToLong(Venta::getUtilidad).sum(),
                porCobrar.stream().mapToLong(Venta::getSaldo).sum(),
                porPagar.stream().mapToLong(Compra::getSaldo).sum(),
                unidades, valor, pendientes, alertas, whatsappConfigurado, activos.size(),
                config.getMetaVentasMes(), config.getMetaUtilidadMes(), clientesConSaldo);
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
                        p.descripcion(), p.precioActual(), (int) p.disponible(),
                        imagenes.getOrDefault(p.id(), List.of()),
                        p.ofertaActiva() ? p.precioVenta() : 0, p.ofertaActiva() ? p.ofertaHasta() : null,
                        p.combo(), p.componentes().stream()
                                .map(c -> (c.cantidad() > 1 ? c.cantidad() + " × " : "") + c.nombre())
                                .collect(java.util.stream.Collectors.joining(", ")),
                        p.precioSeparado(),
                        p.componentes().stream()
                                .map(c -> new ProductoDelSetDto(c.nombre(), c.cantidad(), c.precioActual(),
                                        imagenes.getOrDefault(c.productoId(), List.of()).stream().findFirst().orElse(null)))
                                .toList()))
                .toList();
        return new CatalogoDto(true, configuracion.negocioPublico(), lista);
    }

    /** Aviso tres dias antes del vencimiento y cuando ya esta vencido. */
    private static void agregarVencimiento(List<AlertaDto> alertas, LocalDate vence, LocalDate hoy, String titulo,
            String detalle, String vista) {
        if (vence == null) {
            return;
        }
        String fecha = vence.format(DateTimeFormatter.ofPattern("d 'de' MMMM", Locale.of("es", "CO")));
        if (vence.isBefore(hoy)) {
            alertas.add(new AlertaDto("vencido", titulo, detalle + " · venció el " + fecha, "Vencido", vista));
        } else if (!vence.isAfter(hoy.plusDays(3))) {
            long dias = ChronoUnit.DAYS.between(hoy, vence);
            String cuando = dias == 0 ? "Hoy" : dias == 1 ? "Mañana" : "En " + dias + " días";
            alertas.add(new AlertaDto("por-vencer", titulo, detalle + " · vence el " + fecha, cuando, vista));
        }
    }

    private static List<Venta> activas(List<Venta> lista) {
        return lista.stream().filter(v -> v.getEstado() == EstadoVenta.ACTIVA).toList();
    }
}
