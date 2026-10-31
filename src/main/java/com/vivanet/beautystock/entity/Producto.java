package com.vivanet.beautystock.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Producto del inventario. Las existencias no se guardan aqui: se calculan
 * sumando los lotes disponibles (ver Lote).
 */
@Entity
@Table(name = "productos")
public class Producto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Codigo unico generado automaticamente: P-0001, P-0002... */
    @Column(unique = true, nullable = false)
    private String codigo;

    @Column(nullable = false)
    private String nombre;

    @Column(nullable = false)
    private String marca;

    @ManyToOne
    private Categoria categoria;

    @Column(columnDefinition = "text")
    private String descripcion;

    /** Costo vigente: el de la compra mas reciente (COP, sin decimales). */
    private long costo;

    /** Precio de venta sugerido (COP). */
    private long precioVenta;

    /** Precio de oferta (COP). Vacio = sin oferta. */
    private Long precioOferta;
    /** Fechas opcionales de la oferta: sin fecha, aplica hasta que se quite. */
    private LocalDate ofertaDesde;
    private LocalDate ofertaHasta;

    /** Alerta cuando la existencia sea igual o menor a este valor. */
    private int stockMinimo;

    private boolean activo = true;

    /** Set (combo): no tiene lotes; sus existencias salen de sus componentes (ver ComboItem). */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean combo;

    private LocalDateTime creadoEn = LocalDateTime.now();

    public Long getId() { return id; }
    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo = codigo; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getMarca() { return marca; }
    public void setMarca(String marca) { this.marca = marca; }
    public Categoria getCategoria() { return categoria; }
    public void setCategoria(Categoria categoria) { this.categoria = categoria; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public long getCosto() { return costo; }
    public void setCosto(long costo) { this.costo = costo; }
    public long getPrecioVenta() { return precioVenta; }
    public void setPrecioVenta(long precioVenta) { this.precioVenta = precioVenta; }
    public Long getPrecioOferta() { return precioOferta; }
    public void setPrecioOferta(Long precioOferta) { this.precioOferta = precioOferta; }
    public LocalDate getOfertaDesde() { return ofertaDesde; }
    public void setOfertaDesde(LocalDate ofertaDesde) { this.ofertaDesde = ofertaDesde; }
    public LocalDate getOfertaHasta() { return ofertaHasta; }
    public void setOfertaHasta(LocalDate ofertaHasta) { this.ofertaHasta = ofertaHasta; }

    /** La oferta aplica si tiene precio menor al normal y hoy esta dentro de sus fechas. */
    public boolean ofertaActiva(LocalDate hoy) {
        return precioOferta != null && precioOferta > 0 && precioOferta < precioVenta
                && (ofertaDesde == null || !hoy.isBefore(ofertaDesde))
                && (ofertaHasta == null || !hoy.isAfter(ofertaHasta));
    }

    /** Precio que se cobra hoy: el de oferta si esta activa, si no el normal. */
    public long precioActual(LocalDate hoy) {
        return ofertaActiva(hoy) ? precioOferta : precioVenta;
    }

    public int getStockMinimo() { return stockMinimo; }
    public void setStockMinimo(int stockMinimo) { this.stockMinimo = stockMinimo; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
    public boolean isCombo() { return combo; }
    public void setCombo(boolean combo) { this.combo = combo; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
}
