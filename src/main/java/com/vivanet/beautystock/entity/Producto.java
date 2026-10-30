package com.vivanet.beautystock.entity;

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

    /** Alerta cuando la existencia sea igual o menor a este valor. */
    private int stockMinimo;

    private boolean activo = true;

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
    public int getStockMinimo() { return stockMinimo; }
    public void setStockMinimo(int stockMinimo) { this.stockMinimo = stockMinimo; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
}
