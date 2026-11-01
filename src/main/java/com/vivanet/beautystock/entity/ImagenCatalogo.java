package com.vivanet.beautystock.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Imagen del catalogo que no es de un producto: promociones del carrusel y
 * categorias destacadas. Va en su propia tabla para que listar categorias o
 * promociones no cargue los bytes de la imagen.
 */
@Entity
@Table(name = "imagenes_catalogo")
public class ImagenCatalogo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String contentType;

    @Column(nullable = false)
    private byte[] datos;

    protected ImagenCatalogo() {
    }

    public ImagenCatalogo(String contentType, byte[] datos) {
        this.contentType = contentType;
        this.datos = datos;
    }

    public Long getId() { return id; }
    public String getContentType() { return contentType; }
    public byte[] getDatos() { return datos; }
}
