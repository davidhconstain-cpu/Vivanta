package com.vivanet.beautystock.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Cuantas unidades de una linea de venta salieron de cada lote. */
@Entity
@Table(name = "venta_item_lotes")
public class VentaItemLote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private VentaItem ventaItem;

    @ManyToOne(optional = false)
    private Lote lote;

    private int cantidad;
    private long costoUnitario;

    protected VentaItemLote() {
    }

    public VentaItemLote(VentaItem ventaItem, Lote lote, int cantidad) {
        this.ventaItem = ventaItem;
        this.lote = lote;
        this.cantidad = cantidad;
        this.costoUnitario = lote.getCostoUnitario();
    }

    public Long getId() { return id; }
    public VentaItem getVentaItem() { return ventaItem; }
    public Lote getLote() { return lote; }
    public int getCantidad() { return cantidad; }
    public long getCostoUnitario() { return costoUnitario; }
}
