package com.vivanet.beautystock.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "pedido_items")
public class PedidoItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Pedido pedido;

    @ManyToOne(optional = false)
    private Producto producto;

    private int cantidad;
    private long precioUnitario;
    private long total;

    protected PedidoItem() {
    }

    public PedidoItem(Pedido pedido, Producto producto, int cantidad) {
        this.pedido = pedido;
        this.producto = producto;
        this.cantidad = cantidad;
        this.precioUnitario = producto.precioActual(java.time.LocalDate.now());
        this.total = cantidad * precioUnitario;
    }

    public Long getId() { return id; }
    public Pedido getPedido() { return pedido; }
    public Producto getProducto() { return producto; }
    public int getCantidad() { return cantidad; }
    public long getPrecioUnitario() { return precioUnitario; }
    public long getTotal() { return total; }
}
