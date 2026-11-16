package com.vivanet.beautystock.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Usuario administrador. La contrasena NUNCA se guarda tal cual: se guarda su "huella" BCrypt,
 * que sirve para comprobarla pero no para saber cual era.
 */
@Entity
@Table(name = "administrador")
public class Administrador {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String usuario;

    /** Huella BCrypt de la contrasena actual. */
    @Column(nullable = false)
    private String claveHash;

    /**
     * Huella BCrypt de la variable ADMIN_PASSWORD con la que arranco la app la ultima vez.
     * Si alguien cambia esa variable en Render, la app lo nota al arrancar y la toma como
     * contrasena nueva: es la llave de emergencia si se olvida la contrasena.
     */
    @Column(nullable = false)
    private String claveEntornoHash;

    private LocalDateTime claveCambiada = LocalDateTime.now();

    protected Administrador() {
    }

    public Administrador(String usuario, String claveHash, String claveEntornoHash) {
        this.usuario = usuario;
        this.claveHash = claveHash;
        this.claveEntornoHash = claveEntornoHash;
    }

    public void cambiarClave(String claveHash) {
        this.claveHash = claveHash;
        this.claveCambiada = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getUsuario() { return usuario; }
    public void setUsuario(String usuario) { this.usuario = usuario; }
    public String getClaveHash() { return claveHash; }
    public String getClaveEntornoHash() { return claveEntornoHash; }
    public void setClaveEntornoHash(String claveEntornoHash) { this.claveEntornoHash = claveEntornoHash; }
    public LocalDateTime getClaveCambiada() { return claveCambiada; }
}
