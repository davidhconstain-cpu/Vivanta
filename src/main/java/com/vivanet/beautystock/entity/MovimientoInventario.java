package com.vivanet.beautystock.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Historial de entradas y salidas de inventario. Cantidad positiva = entrada. */
@Entity
@Table(name = "movimientos_inventario")
public class MovimientoInventario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Producto producto;

    private LocalDateTime fecha = LocalDateTime.now();

    @Enumerated(EnumType.STRING)
    private TipoMovimiento tipo;

    private int cantidad;

    /** Documento relacionado: C-0001, V-0001... */
    private String referencia;

    private String motivo;

    protected MovimientoInventario() {
    }

    public MovimientoInventario(Producto producto, TipoMovimiento tipo, int cantidad, String referencia, String motivo) {
        this.producto = producto;
        this.tipo = tipo;
        this.cantidad = cantidad;
        this.referencia = referencia;
        this.motivo = motivo;
    }

    public Long getId() { return id; }
    public Producto getProducto() { return producto; }
    public LocalDateTime getFecha() { return fecha; }
    public TipoMovimiento getTipo() { return tipo; }
    public int getCantidad() { return cantidad; }
    public String getReferencia() { return referencia; }
    public String getMotivo() { return motivo; }
}
