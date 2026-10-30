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

/** Pago o abono a una compra. Consecutivo PP-0001. */
@Entity
@Table(name = "pagos_compra")
public class PagoCompra {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String numero;

    @ManyToOne(optional = false)
    private Compra compra;

    private LocalDateTime fecha = LocalDateTime.now();
    private long valor;

    @Enumerated(EnumType.STRING)
    private MetodoPago metodo;

    protected PagoCompra() {
    }

    public PagoCompra(String numero, Compra compra, long valor, MetodoPago metodo) {
        this.numero = numero;
        this.compra = compra;
        this.valor = valor;
        this.metodo = metodo;
    }

    public Long getId() { return id; }
    public String getNumero() { return numero; }
    public Compra getCompra() { return compra; }
    public LocalDateTime getFecha() { return fecha; }
    public long getValor() { return valor; }
    public MetodoPago getMetodo() { return metodo; }
}
