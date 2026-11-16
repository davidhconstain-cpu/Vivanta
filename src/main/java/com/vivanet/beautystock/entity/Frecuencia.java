package com.vivanet.beautystock.entity;

import java.time.LocalDate;

/** Cada cuanto se repite un gasto recurrente. */
public enum Frecuencia {
    SEMANAL, QUINCENAL, MENSUAL, TRIMESTRAL, ANUAL;

    /**
     * Fecha de la repeticion numero n (0 = la primera), contada siempre desde la fecha inicial.
     * Asi un gasto mensual del 31 cae el 30 en abril y vuelve al 31 en mayo, sin correrse.
     */
    public LocalDate fecha(LocalDate inicio, int n) {
        return switch (this) {
            case SEMANAL -> inicio.plusWeeks(n);
            case QUINCENAL -> inicio.plusDays(15L * n);
            case MENSUAL -> inicio.plusMonths(n);
            case TRIMESTRAL -> inicio.plusMonths(3L * n);
            case ANUAL -> inicio.plusYears(n);
        };
    }
}
