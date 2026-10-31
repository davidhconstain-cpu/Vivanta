package com.vivanet.beautystock.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Un producto que forma parte de un set (combo). El set no tiene lotes propios:
 * al venderlo se descuentan sus componentes del inventario.
 */
@Entity
@Table(name = "combo_items")
public class ComboItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** El set. */
    @ManyToOne(optional = false)
    private Producto combo;

    /** El producto que incluye. */
    @ManyToOne(optional = false)
    private Producto producto;

    /** Unidades de este producto en cada set. */
    private int cantidad;

    protected ComboItem() {
    }

    public ComboItem(Producto combo, Producto producto, int cantidad) {
        this.combo = combo;
        this.producto = producto;
        this.cantidad = cantidad;
    }

    public Long getId() { return id; }
    public Producto getCombo() { return combo; }
    public Producto getProducto() { return producto; }
    public int getCantidad() { return cantidad; }
}
