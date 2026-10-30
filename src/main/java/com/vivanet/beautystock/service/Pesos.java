package com.vivanet.beautystock.service;

import java.text.NumberFormat;
import java.util.Locale;

/** Formato de pesos colombianos sin decimales: $125.000 */
public final class Pesos {

    private static final Locale COLOMBIA = Locale.of("es", "CO");

    private Pesos() {
    }

    public static String formato(long valor) {
        return "$" + NumberFormat.getIntegerInstance(COLOMBIA).format(valor);
    }
}
