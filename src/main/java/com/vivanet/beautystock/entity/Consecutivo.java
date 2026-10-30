package com.vivanet.beautystock.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Ultimo numero usado de cada secuencia: P, C, V, AC, PP, PED. */
@Entity
@Table(name = "consecutivos")
public class Consecutivo {

    @Id
    private String prefijo;

    private int ultimo;

    protected Consecutivo() {
    }

    public Consecutivo(String prefijo) {
        this.prefijo = prefijo;
    }

    public String getPrefijo() { return prefijo; }
    public int getUltimo() { return ultimo; }
    public void setUltimo(int ultimo) { this.ultimo = ultimo; }
}
