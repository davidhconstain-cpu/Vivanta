package com.vivanet.beautystock.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "compra_items")
public class CompraItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Compra compra;

    @ManyToOne(optional = false)
    private Producto producto;

    private int cantidad;
    private long costoUnitario;
    private long subtotal;

    protected CompraItem() {
    }

    public CompraItem(Compra compra, Producto producto, int cantidad, long costoUnitario) {
        this.compra = compra;
        this.producto = producto;
        this.cantidad = cantidad;
        this.costoUnitario = costoUnitario;
        this.subtotal = cantidad * costoUnitario;
    }

    public Long getId() { return id; }
    public Compra getCompra() { return compra; }
    public Producto getProducto() { return producto; }
    public int getCantidad() { return cantidad; }
    public long getCostoUnitario() { return costoUnitario; }
    public long getSubtotal() { return subtotal; }
}
