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
 * promociones no cargue los bytes de la imagen. Con Cloudinary solo guarda la direccion (url).
 */
@Entity
@Table(name = "imagenes_catalogo")
public class ImagenCatalogo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String contentType;

    private byte[] datos;

    private String url;

    private String publicId;

    protected ImagenCatalogo() {
    }

    public ImagenCatalogo(String contentType, byte[] datos) {
        this.contentType = contentType;
        this.datos = datos;
    }

    public Long getId() { return id; }
    public String getContentType() { return contentType; }
    public byte[] getDatos() { return datos; }
    public String getUrl() { return url; }
    public String getPublicId() { return publicId; }

    /** Al pasar la foto a Cloudinary. */
    public void enNube(String url, String publicId) {
        this.url = url;
        this.publicId = publicId;
    }
}
