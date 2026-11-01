package com.vivanet.beautystock.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Una diapositiva del carrusel de promociones del catalogo. */
@Entity
@Table(name = "promociones")
public class Promocion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Posicion en el carrusel (menor = primero). */
    private int orden;

    /** Texto pequeño sobre el titulo, por ejemplo "Natura". */
    private String marca;

    @Column(nullable = false)
    private String titulo;

    @Column(columnDefinition = "text")
    private String texto;

    /** Producto que se abre al tocar la promocion (opcional). */
    private Long productoId;

    private boolean activa = true;

    /** Foto de la promocion en ImagenCatalogo (opcional). */
    private Long imagenId;

    public Long getId() { return id; }
    public int getOrden() { return orden; }
    public void setOrden(int orden) { this.orden = orden; }
    public String getMarca() { return marca; }
    public void setMarca(String marca) { this.marca = marca; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getTexto() { return texto; }
    public void setTexto(String texto) { this.texto = texto; }
    public Long getProductoId() { return productoId; }
    public void setProductoId(Long productoId) { this.productoId = productoId; }
    public boolean isActiva() { return activa; }
    public void setActiva(boolean activa) { this.activa = activa; }
    public Long getImagenId() { return imagenId; }
    public void setImagenId(Long imagenId) { this.imagenId = imagenId; }
}
