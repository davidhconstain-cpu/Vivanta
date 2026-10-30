package com.vivanet.beautystock.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/** Entrada de mercancia. Cada item genera un lote de inventario. */
@Entity
@Table(name = "compras")
public class Compra {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Consecutivo C-0001, C-0002... */
    @Column(unique = true, nullable = false)
    private String numero;

    private LocalDate fecha;
    private LocalDateTime registradaEn = LocalDateTime.now();

    /** Proveedor opcional, texto libre. */
    private String proveedor;

    @OneToMany(mappedBy = "compra", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<CompraItem> items = new ArrayList<>();

    /** Valor de los productos: lo que se le debe al proveedor. */
    private long total;

    /** Transporte u otros costos; se registran aparte y no se reparten entre productos. */
    private long costosAdicionales;
    private String notaCostosAdicionales;

    private long pagado;

    /** Fecha limite para pagar cuando la compra es a credito. */
    private LocalDate fechaVencimiento;

    @OneToMany(mappedBy = "compra", cascade = CascadeType.ALL)
    @OrderBy("fecha")
    private List<PagoCompra> pagos = new ArrayList<>();

    /** Una compra anulada ya no se debe; sus unidades salieron del inventario. */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean anulada;
    private String motivoAnulacion;
    private LocalDateTime fechaAnulacion;

    public long getSaldo() { return anulada ? 0 : total - pagado; }

    public boolean isAnulada() { return anulada; }
    public void setAnulada(boolean anulada) { this.anulada = anulada; }
    public String getMotivoAnulacion() { return motivoAnulacion; }
    public void setMotivoAnulacion(String motivoAnulacion) { this.motivoAnulacion = motivoAnulacion; }
    public LocalDateTime getFechaAnulacion() { return fechaAnulacion; }
    public void setFechaAnulacion(LocalDateTime fechaAnulacion) { this.fechaAnulacion = fechaAnulacion; }

    public Long getId() { return id; }
    public String getNumero() { return numero; }
    public void setNumero(String numero) { this.numero = numero; }
    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }
    public LocalDateTime getRegistradaEn() { return registradaEn; }
    public String getProveedor() { return proveedor; }
    public void setProveedor(String proveedor) { this.proveedor = proveedor; }
    public List<CompraItem> getItems() { return items; }
    public long getTotal() { return total; }
    public void setTotal(long total) { this.total = total; }
    public long getCostosAdicionales() { return costosAdicionales; }
    public void setCostosAdicionales(long costosAdicionales) { this.costosAdicionales = costosAdicionales; }
    public String getNotaCostosAdicionales() { return notaCostosAdicionales; }
    public void setNotaCostosAdicionales(String nota) { this.notaCostosAdicionales = nota; }
    public long getPagado() { return pagado; }
    public void setPagado(long pagado) { this.pagado = pagado; }
    public LocalDate getFechaVencimiento() { return fechaVencimiento; }
    public void setFechaVencimiento(LocalDate fechaVencimiento) { this.fechaVencimiento = fechaVencimiento; }
    public List<PagoCompra> getPagos() { return pagos; }
}
