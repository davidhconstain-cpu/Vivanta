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

/** Pago o abono de un cliente a una venta. Consecutivo AC-0001. */
@Entity
@Table(name = "pagos_venta")
public class PagoVenta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String numero;

    @ManyToOne(optional = false)
    private Venta venta;

    private LocalDateTime fecha = LocalDateTime.now();
    private long valor;

    @Enumerated(EnumType.STRING)
    private MetodoPago metodo;

    protected PagoVenta() {
    }

    public PagoVenta(String numero, Venta venta, long valor, MetodoPago metodo) {
        this.numero = numero;
        this.venta = venta;
        this.valor = valor;
        this.metodo = metodo;
    }

    public Long getId() { return id; }
    public String getNumero() { return numero; }
    public Venta getVenta() { return venta; }
    public LocalDateTime getFecha() { return fecha; }
    public long getValor() { return valor; }
    public MetodoPago getMetodo() { return metodo; }
}
