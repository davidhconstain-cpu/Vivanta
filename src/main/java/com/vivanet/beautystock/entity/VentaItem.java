package com.vivanet.beautystock.entity;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "venta_items")
public class VentaItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Venta venta;

    @ManyToOne(optional = false)
    private Producto producto;

    private int cantidad;

    /** Precio de lista del producto en el momento de la venta. */
    private long precioLista;
    /** Precio unitario realmente cobrado. */
    private long precioUnitario;

    @Enumerated(EnumType.STRING)
    private TipoDescuento descuentoTipo;
    private long descuentoValor;
    /** Descuento de la linea en pesos. */
    private long descuento;

    private long total;
    /** Costo real de los lotes consumidos para esta linea. */
    private long costo;

    /** Lotes de los que salieron las unidades (PEPS). */
    @OneToMany(mappedBy = "ventaItem", cascade = CascadeType.ALL)
    private List<VentaItemLote> lotes = new ArrayList<>();

    protected VentaItem() {
    }

    public VentaItem(Venta venta, Producto producto, int cantidad, long precioUnitario) {
        this.venta = venta;
        this.producto = producto;
        this.cantidad = cantidad;
        this.precioLista = producto.getPrecioVenta();
        this.precioUnitario = precioUnitario;
    }

    public Long getId() { return id; }
    public Venta getVenta() { return venta; }
    public Producto getProducto() { return producto; }
    public int getCantidad() { return cantidad; }
    public long getPrecioLista() { return precioLista; }
    public long getPrecioUnitario() { return precioUnitario; }
    public TipoDescuento getDescuentoTipo() { return descuentoTipo; }
    public void setDescuentoTipo(TipoDescuento descuentoTipo) { this.descuentoTipo = descuentoTipo; }
    public long getDescuentoValor() { return descuentoValor; }
    public void setDescuentoValor(long descuentoValor) { this.descuentoValor = descuentoValor; }
    public long getDescuento() { return descuento; }
    public void setDescuento(long descuento) { this.descuento = descuento; }
    public long getTotal() { return total; }
    public void setTotal(long total) { this.total = total; }
    public long getCosto() { return costo; }
    public void setCosto(long costo) { this.costo = costo; }
    public List<VentaItemLote> getLotes() { return lotes; }
}
