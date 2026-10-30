package com.vivanet.beautystock.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "historial_precios")
public class HistorialPrecio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Producto producto;

    private LocalDateTime fecha = LocalDateTime.now();
    private long precioAnterior;
    private long precioNuevo;

    protected HistorialPrecio() {
    }

    public HistorialPrecio(Producto producto, long precioAnterior, long precioNuevo) {
        this.producto = producto;
        this.precioAnterior = precioAnterior;
        this.precioNuevo = precioNuevo;
    }

    public Long getId() { return id; }
    public Producto getProducto() { return producto; }
    public LocalDateTime getFecha() { return fecha; }
    public long getPrecioAnterior() { return precioAnterior; }
    public long getPrecioNuevo() { return precioNuevo; }
}
