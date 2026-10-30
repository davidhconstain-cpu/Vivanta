package com.vivanet.beautystock.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

@Entity
@Table(name = "ventas")
public class Venta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Consecutivo V-0001, V-0002... */
    @Column(unique = true, nullable = false)
    private String numero;

    private LocalDateTime fechaHora = LocalDateTime.now();

    @ManyToOne
    private Cliente cliente;

    @OneToMany(mappedBy = "venta", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<VentaItem> items = new ArrayList<>();

    /** Suma de las lineas, despues del descuento de cada linea. */
    private long subtotal;

    @Enumerated(EnumType.STRING)
    private TipoDescuento descuentoTipo;
    private long descuentoValor;
    /** Descuento sobre toda la venta, en pesos. */
    private long descuentoGlobal;

    /** Domicilio cobrado (pedidos del catalogo). No cuenta en la utilidad. */
    private long cargoDomicilio;

    private long total;
    /** Costo real de los lotes consumidos (PEPS). */
    private long costoTotal;
    private long utilidad;
    private long pagado;

    private LocalDate fechaVencimiento;

    @Enumerated(EnumType.STRING)
    private EstadoVenta estado = EstadoVenta.ACTIVA;

    private String motivoAnulacion;
    private LocalDateTime fechaAnulacion;

    @Column(columnDefinition = "text")
    private String notas;

    /** Numero del pedido del catalogo que origino la venta, si aplica. */
    private String pedidoNumero;

    @OneToMany(mappedBy = "venta", cascade = CascadeType.ALL)
    @OrderBy("fecha")
    private List<PagoVenta> pagos = new ArrayList<>();

    public long getSaldo() { return estado == EstadoVenta.ANULADA ? 0 : total - pagado; }

    public Long getId() { return id; }
    public String getNumero() { return numero; }
    public void setNumero(String numero) { this.numero = numero; }
    public LocalDateTime getFechaHora() { return fechaHora; }
    public Cliente getCliente() { return cliente; }
    public void setCliente(Cliente cliente) { this.cliente = cliente; }
    public List<VentaItem> getItems() { return items; }
    public long getSubtotal() { return subtotal; }
    public void setSubtotal(long subtotal) { this.subtotal = subtotal; }
    public TipoDescuento getDescuentoTipo() { return descuentoTipo; }
    public void setDescuentoTipo(TipoDescuento descuentoTipo) { this.descuentoTipo = descuentoTipo; }
    public long getDescuentoValor() { return descuentoValor; }
    public void setDescuentoValor(long descuentoValor) { this.descuentoValor = descuentoValor; }
    public long getDescuentoGlobal() { return descuentoGlobal; }
    public void setDescuentoGlobal(long descuentoGlobal) { this.descuentoGlobal = descuentoGlobal; }
    public long getCargoDomicilio() { return cargoDomicilio; }
    public void setCargoDomicilio(long cargoDomicilio) { this.cargoDomicilio = cargoDomicilio; }
    public long getTotal() { return total; }
    public void setTotal(long total) { this.total = total; }
    public long getCostoTotal() { return costoTotal; }
    public void setCostoTotal(long costoTotal) { this.costoTotal = costoTotal; }
    public long getUtilidad() { return utilidad; }
    public void setUtilidad(long utilidad) { this.utilidad = utilidad; }
    public long getPagado() { return pagado; }
    public void setPagado(long pagado) { this.pagado = pagado; }
    public LocalDate getFechaVencimiento() { return fechaVencimiento; }
    public void setFechaVencimiento(LocalDate fechaVencimiento) { this.fechaVencimiento = fechaVencimiento; }
    public EstadoVenta getEstado() { return estado; }
    public void setEstado(EstadoVenta estado) { this.estado = estado; }
    public String getMotivoAnulacion() { return motivoAnulacion; }
    public void setMotivoAnulacion(String motivoAnulacion) { this.motivoAnulacion = motivoAnulacion; }
    public LocalDateTime getFechaAnulacion() { return fechaAnulacion; }
    public void setFechaAnulacion(LocalDateTime fechaAnulacion) { this.fechaAnulacion = fechaAnulacion; }
    public String getNotas() { return notas; }
    public void setNotas(String notas) { this.notas = notas; }
    public String getPedidoNumero() { return pedidoNumero; }
    public void setPedidoNumero(String pedidoNumero) { this.pedidoNumero = pedidoNumero; }
    public List<PagoVenta> getPagos() { return pagos; }
}
