package com.vivanet.beautystock.service;

import java.util.List;

/**
 * La operacion se puede hacer, pero el usuario debe confirmarla antes
 * (venta por debajo del costo, limite de credito superado...).
 * Al lanzarse se deshace todo lo hecho en la transaccion.
 */
public class AdvertenciaException extends RuntimeException {

    private final List<String> advertencias;

    public AdvertenciaException(List<String> advertencias) {
        super(String.join(" ", advertencias));
        this.advertencias = advertencias;
    }

    public List<String> getAdvertencias() {
        return advertencias;
    }
}
