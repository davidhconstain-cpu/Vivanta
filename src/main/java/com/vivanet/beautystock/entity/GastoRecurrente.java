package com.vivanet.beautystock.entity;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Gasto que se repite (arriendo, internet, plan del celular...). El sistema crea cada repeticion
 * como un gasto pendiente unos dias antes de su fecha; el usuario lo marca como pagado.
 */
@Entity
@Table(name = "gastos_recurrentes")
public class GastoRecurrente {

    /** Dias antes de la fecha en que se crea el gasto pendiente (y empieza la alerta). */
    public static final int DIAS_DE_AVISO = 3;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String concepto;

    private long valor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Frecuencia frecuencia;

    /** Fecha de la primera repeticion; las demas se cuentan desde aqui. */
    @Column(nullable = false)
    private LocalDate inicio;

    /** Cuantas repeticiones ya se crearon como gasto pendiente. */
    private int generados;

    private boolean activo = true;

    /** Fecha de la siguiente repeticion que todavia no se ha creado. */
    public LocalDate getProximaFecha() {
        return frecuencia.fecha(inicio, generados);
    }

    /** Empieza de nuevo desde otra fecha (al crear o al cambiar la fecha o la frecuencia). */
    public void reiniciar(Frecuencia frecuencia, LocalDate proximaFecha) {
        this.frecuencia = frecuencia;
        this.inicio = proximaFecha;
        this.generados = 0;
    }

    public void avanzar() {
        generados++;
    }

    public Long getId() { return id; }
    public String getConcepto() { return concepto; }
    public void setConcepto(String concepto) { this.concepto = concepto; }
    public long getValor() { return valor; }
    public void setValor(long valor) { this.valor = valor; }
    public Frecuencia getFrecuencia() { return frecuencia; }
    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
}
