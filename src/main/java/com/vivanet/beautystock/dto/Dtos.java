package com.vivanet.beautystock.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import com.vivanet.beautystock.entity.EstadoPedido;
import com.vivanet.beautystock.entity.FormaPagoPedido;
import com.vivanet.beautystock.entity.MetodoPago;
import com.vivanet.beautystock.entity.TipoDescuento;
import com.vivanet.beautystock.entity.TipoEntrega;
import com.vivanet.beautystock.entity.TipoMovimiento;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/**
 * Objetos que viajan entre el navegador y el servidor (JSON).
 * Los "...Request" llegan desde el navegador; el resto se envia como respuesta.
 */
public final class Dtos {

    private Dtos() {
    }

    // ---------- Productos ----------

    public record CategoriaDto(Long id, @NotBlank String nombre) {
    }

    public record ProductoRequest(
            @NotBlank String nombre,
            @NotBlank String marca,
            Long categoriaId,
            String descripcion,
            @Min(0) long costo,
            @Min(0) long precioVenta,
            @Min(0) int stockMinimo,
            /** Oferta opcional: vacio = sin oferta. */
            @Min(0) Long precioOferta,
            LocalDate ofertaDesde,
            LocalDate ofertaHasta,
            /** Solo para sets: los productos que incluye. */
            List<@Valid ComponenteRequest> componentes) {
    }

    public record ComponenteRequest(@NotNull Long productoId, @Min(1) int cantidad) {
    }

    public record ComponenteDto(Long productoId, String codigo, String nombre, int cantidad, long precioActual,
            long disponible) {
    }

    public record ProductoDto(
            Long id, String codigo, String nombre, String marca,
            Long categoriaId, String categoriaNombre, String descripcion,
            long costo, long precioVenta, long precioSugerido, int stockMinimo, boolean activo,
            long existencias, long reservado, long disponible, boolean stockBajo,
            List<Long> imagenes,
            Long precioOferta, LocalDate ofertaDesde, LocalDate ofertaHasta,
            /** Si la oferta aplica hoy y el precio que se cobra hoy. */
            boolean ofertaActiva, long precioActual,
            /** Sets: lo que incluye y cuanto costaria por separado. */
            boolean combo, List<ComponenteDto> componentes, long precioSeparado) {
    }

    public record HistorialPrecioDto(LocalDateTime fecha, long precioAnterior, long precioNuevo) {
    }

    // ---------- Inventario ----------

    public record LoteDto(Long id, LocalDateTime fecha, String origen, int cantidadInicial,
            int cantidadDisponible, long costoUnitario) {
    }

    public record MovimientoDto(Long id, LocalDateTime fecha, Long productoId, String productoCodigo,
            String productoNombre, TipoMovimiento tipo, int cantidad, String referencia, String motivo) {
    }

    public record AjusteRequest(@NotNull Long productoId, int cantidad, String motivo) {
    }

    // ---------- Compras ----------

    public record CompraItemRequest(@NotNull Long productoId, @Min(1) int cantidad, @Min(0) long costoUnitario) {
    }

    public record CompraRequest(
            LocalDate fecha,
            String proveedor,
            @NotEmpty List<@Valid CompraItemRequest> items,
            @Min(0) long costosAdicionales,
            String notaCostosAdicionales,
            @Min(0) long montoPagado,
            MetodoPago metodoPago,
            LocalDate fechaVencimiento,
            boolean actualizarPrecios) {
    }

    public record CompraItemDto(Long productoId, String productoCodigo, String productoNombre,
            int cantidad, long costoUnitario, long subtotal) {
    }

    public record PagoDto(Long id, String numero, LocalDateTime fecha, long valor, MetodoPago metodo,
            String documento) {
    }

    public record CompraDto(Long id, String numero, LocalDate fecha, String proveedor, long total,
            long costosAdicionales, String notaCostosAdicionales, long pagado, long saldo,
            LocalDate fechaVencimiento, List<CompraItemDto> items, List<PagoDto> pagos,
            boolean anulada, String motivoAnulacion, LocalDateTime fechaAnulacion) {
    }

    public record PagoRequest(@Min(1) long valor, @NotNull MetodoPago metodo) {
    }

    // ---------- Clientes ----------

    public record ClienteRequest(@NotBlank String nombre, String telefono, String direccion,
            String documento, Long limiteCredito) {
    }

    public record ClienteDto(Long id, String nombre, String telefono, String direccion, String documento,
            Long limiteCredito, long saldo, LocalDateTime ultimaCompra) {
    }

    public record ClienteDetalleDto(ClienteDto cliente, List<VentaDto> ventas, List<PagoDto> pagos) {
    }

    // ---------- Ventas ----------

    public record VentaItemRequest(@NotNull Long productoId, @Min(1) int cantidad, @Min(0) long precioUnitario,
            TipoDescuento descuentoTipo, @Min(0) long descuentoValor) {
    }

    public record VentaRequest(
            Long clienteId,
            @NotEmpty List<@Valid VentaItemRequest> items,
            TipoDescuento descuentoTipo,
            @Min(0) long descuentoValor,
            @Min(0) long montoPagado,
            MetodoPago metodoPago,
            LocalDate fechaVencimiento,
            String notas,
            /** true cuando el usuario ya vio las advertencias y decidio continuar. */
            boolean confirmarAdvertencias) {
    }

    public record VentaItemDto(Long productoId, String productoCodigo, String productoNombre, int cantidad,
            long precioLista, long precioUnitario, long descuento, long total, long costo) {
    }

    public record VentaDto(Long id, String numero, LocalDateTime fechaHora, Long clienteId, String clienteNombre,
            String clienteTelefono, long subtotal, long descuentoGlobal, long cargoDomicilio, long total,
            long costoTotal, long utilidad, long pagado, long saldo, LocalDate fechaVencimiento, String estado,
            String motivoAnulacion, LocalDateTime fechaAnulacion, String notas, String pedidoNumero,
            List<VentaItemDto> items, List<PagoDto> pagos) {
    }

    public record AnularRequest(@NotBlank String motivo) {
    }

    // ---------- Pedidos ----------

    public record PedidoItemRequest(@NotNull Long productoId, @Min(1) int cantidad) {
    }

    public record PedidoRequest(
            @NotBlank String nombre,
            @NotBlank String telefono,
            @NotNull TipoEntrega tipoEntrega,
            FormaPagoPedido formaPago,
            String direccion,
            String observaciones,
            @NotEmpty List<@Valid PedidoItemRequest> items) {
    }

    public record PedidoItemDto(Long productoId, String productoNombre, int cantidad, long precioUnitario,
            long total) {
    }

    public record PedidoDto(Long id, String numero, LocalDateTime fechaHora, String nombreCliente, String telefono,
            TipoEntrega tipoEntrega, FormaPagoPedido formaPago, String direccion, String observaciones,
            long subtotal, long costoDomicilio,
            long total, EstadoPedido estado, Long ventaId, String ventaNumero, List<PedidoItemDto> items) {
    }

    public record PedidoCreadoDto(String numero, long total, String whatsappUrl) {
    }

    public record EstadoPedidoRequest(@NotNull EstadoPedido estado) {
    }

    // ---------- Configuracion y catalogo ----------

    public record ConfiguracionDto(
            String nombreNegocio, String telefono, String whatsapp, String direccion, String correo,
            String horarios, String instagram, String facebook, String tiktok,
            @Min(0) int porcentajeIncremento, @Min(0) long costoDomicilio,
            boolean catalogoHabilitado, boolean mostrarAgotados, String notasRecibo,
            boolean reciboMostrarLogo, boolean reciboMostrarDireccion, boolean reciboMostrarTelefono,
            boolean reciboMostrarCliente, boolean tieneLogo,
            @Min(0) long metaVentasMes, @Min(0) long metaUtilidadMes) {
    }

    public record NegocioPublicoDto(String nombreNegocio, String telefono, String whatsapp, String direccion,
            String correo, String horarios, String instagram, String facebook, String tiktok,
            long costoDomicilio, boolean tieneLogo) {
    }

    public record ProductoCatalogoDto(Long id, String nombre, String marca, String categoria, String descripcion,
            long precio, int disponible, List<Long> imagenes,
            /** Con oferta activa: precio normal (tachado) y ultimo dia; si no, 0 y null. */
            long precioAntes, LocalDate ofertaHasta,
            /** Sets: "Kaiak Clasico, Kaiak Aventura" y el precio de comprarlos por separado. */
            boolean combo, String incluye, long precioSeparado) {
    }

    public record CatalogoDto(boolean habilitado, NegocioPublicoDto negocio, List<ProductoCatalogoDto> productos) {
    }

    // ---------- Panel ----------

    /** Alerta del panel: titulo, detalle, etiqueta corta ("Agotado", "En 3 dias") y vista a la que lleva. */
    public record AlertaDto(String tipo, String titulo, String detalle, String etiqueta, String vista) {
    }

    public record PanelDto(long ventasHoy, long utilidadHoy, int numeroVentasHoy, long ventasMes, long utilidadMes,
            long cuentasPorCobrar, long cuentasPorPagar, long unidadesInventario, long valorInventario,
            long pedidosPendientes, List<AlertaDto> alertas,
            /** Para la guia de primeros pasos del panel. */
            boolean whatsappConfigurado, int productosActivos,
            long metaVentasMes, long metaUtilidadMes, long clientesConSaldo) {
    }
}
