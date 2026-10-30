package com.vivanet.beautystock.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Lote de inventario: unidades que entraron juntas con un mismo costo.
 * Las ventas consumen primero los lotes mas antiguos (PEPS).
 */
@Entity
@Table(name = "lotes")
public class Lote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Producto producto;

    private LocalDateTime fecha = LocalDateTime.now();
    private int cantidadInicial;
    private int cantidadDisponible;
    private long costoUnitario;

    /** De donde vino el lote, por ejemplo "Compra C-0001" o "Ajuste". */
    private String origen;

    protected Lote() {
    }

    public Lote(Producto producto, int cantidad, long costoUnitario, String origen) {
        this.producto = producto;
        this.cantidadInicial = cantidad;
        this.cantidadDisponible = cantidad;
        this.costoUnitario = costoUnitario;
        this.origen = origen;
    }

    public Long getId() { return id; }
    public Producto getProducto() { return producto; }
    public LocalDateTime getFecha() { return fecha; }
    public int getCantidadInicial() { return cantidadInicial; }
    public int getCantidadDisponible() { return cantidadDisponible; }
    public void setCantidadDisponible(int cantidadDisponible) { this.cantidadDisponible = cantidadDisponible; }
    public long getCostoUnitario() { return costoUnitario; }
    public String getOrigen() { return origen; }
}
