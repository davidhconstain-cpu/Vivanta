package com.vivanet.beautystock.service;

/** Error de una regla del negocio (por ejemplo, stock insuficiente). Se muestra al usuario. */
public class NegocioException extends RuntimeException {

    public NegocioException(String mensaje) {
        super(mensaje);
    }
}
