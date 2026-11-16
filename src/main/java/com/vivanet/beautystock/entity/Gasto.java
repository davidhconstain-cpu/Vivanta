package com.vivanet.beautystock.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Gasto general del negocio (sin categorias, como pide el DDI). Puede estar pagado o pendiente;
 * los pendientes los crea el sistema a partir de los gastos recurrentes.
 */
@Entity
// Una misma repeticion de un gasto recurrente no se puede crear dos veces.
@Table(name = "gastos", uniqueConstraints = @UniqueConstraint(columnNames = { "recurrente_id", "fecha" }))
public class Gasto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Fecha del gasto o, si esta pendiente, fecha en que vence. */
    @Column(nullable = false)
    private LocalDate fecha;

    @Column(nullable = false)
    private String concepto;

    private long valor;

    @Enumerated(EnumType.STRING)
    private MetodoPago metodo;

    private boolean pagado;

    /** Dia en que salio la plata. Los reportes cuentan el gasto en esta fecha. */
    private LocalDate fechaPago;

    @ManyToOne(fetch = FetchType.LAZY)
    private GastoRecurrente recurrente;

    private LocalDateTime registradoEn = LocalDateTime.now();

    protected Gasto() {
    }

    public Gasto(LocalDate fecha, String concepto, long valor) {
        this.fecha = fecha;
        this.concepto = concepto;
        this.valor = valor;
    }

    /** Repeticion pendiente de un gasto recurrente. */
    public static Gasto pendienteDe(GastoRecurrente r, LocalDate fecha) {
        Gasto g = new Gasto(fecha, r.getConcepto(), r.getValor());
        g.recurrente = r;
        return g;
    }

    public void marcarPagado(LocalDate fechaPago, MetodoPago metodo) {
        this.pagado = true;
        this.fechaPago = fechaPago;
        this.metodo = metodo;
    }

    public void marcarPendiente() {
        this.pagado = false;
        this.fechaPago = null;
        this.metodo = null;
    }

    public Long getId() { return id; }
    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }
    public String getConcepto() { return concepto; }
    public void setConcepto(String concepto) { this.concepto = concepto; }
    public long getValor() { return valor; }
    public void setValor(long valor) { this.valor = valor; }
    public MetodoPago getMetodo() { return metodo; }
    public boolean isPagado() { return pagado; }
    public LocalDate getFechaPago() { return fechaPago; }
    public GastoRecurrente getRecurrente() { return recurrente; }
}
