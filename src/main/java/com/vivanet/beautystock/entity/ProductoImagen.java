package com.vivanet.beautystock.entity;

import jakarta.persistence.Basic;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Imagen de un producto: en Cloudinary (url) o, sin Cloudinary, en la base de datos (datos). */
@Entity
@Table(name = "producto_imagenes")
public class ProductoImagen {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Producto producto;

    private String contentType;

    @Basic(fetch = FetchType.LAZY)
    private byte[] datos;

    private boolean principal;

    /** Direccion en Cloudinary; si es null, la foto esta en datos. */
    private String url;

    private String publicId;

    public Long getId() { return id; }
    public Producto getProducto() { return producto; }
    public void setProducto(Producto producto) { this.producto = producto; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public byte[] getDatos() { return datos; }
    public void setDatos(byte[] datos) { this.datos = datos; }
    public boolean isPrincipal() { return principal; }
    public void setPrincipal(boolean principal) { this.principal = principal; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getPublicId() { return publicId; }
    public void setPublicId(String publicId) { this.publicId = publicId; }
}
