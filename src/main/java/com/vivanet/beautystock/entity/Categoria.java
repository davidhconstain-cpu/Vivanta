package com.vivanet.beautystock.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "categorias")
public class Categoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String nombre;

    /** Aparece en "Nuestras categorias mas buscadas" del catalogo (maximo 3). */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean destacada;

    /** Foto para la tarjeta destacada, en ImagenCatalogo (opcional). */
    private Long imagenId;

    public Long getId() { return id; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public boolean isDestacada() { return destacada; }
    public void setDestacada(boolean destacada) { this.destacada = destacada; }
    public Long getImagenId() { return imagenId; }
    public void setImagenId(Long imagenId) { this.imagenId = imagenId; }
}
