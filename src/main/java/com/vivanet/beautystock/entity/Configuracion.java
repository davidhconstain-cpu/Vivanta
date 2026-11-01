package com.vivanet.beautystock.entity;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Datos del negocio y ajustes generales. Siempre hay una sola fila (id = 1). */
@Entity
@Table(name = "configuracion")
public class Configuracion {

    @Id
    private Long id = 1L;

    public static final String NOMBRE_INICIAL = "Vivanta Colección";

    private String nombreNegocio = NOMBRE_INICIAL;
    private String telefono;
    /** Numero de WhatsApp que recibe los pedidos del catalogo. */
    private String whatsapp;
    private String direccion;
    private String correo;
    private String horarios;
    private String instagram;
    private String facebook;
    private String tiktok;

    /** Incremento sobre el costo para el precio sugerido. 100 = duplicar el costo. */
    private int porcentajeIncremento = 100;

    private long costoDomicilio;

    /** El domicilio sale gratis cuando el pedido llega a este valor (0 = nunca). */
    @Column(nullable = false, columnDefinition = "bigint default 0")
    private long envioGratisDesde;

    /** Metas mensuales que muestra el panel (0 = sin meta). */
    @Column(nullable = false, columnDefinition = "bigint default 0")
    private long metaVentasMes;
    @Column(nullable = false, columnDefinition = "bigint default 0")
    private long metaUtilidadMes;

    private boolean catalogoHabilitado = true;
    /** true: los agotados se ven con etiqueta "Agotado"; false: se ocultan. */
    private boolean mostrarAgotados = true;

    @Column(columnDefinition = "text")
    private String notasRecibo;

    private boolean reciboMostrarLogo = true;
    private boolean reciboMostrarDireccion = true;
    private boolean reciboMostrarTelefono = true;
    private boolean reciboMostrarCliente = true;

    private String logoContentType;

    @Basic(fetch = FetchType.LAZY)
    private byte[] logo;

    public Long getId() { return id; }
    public String getNombreNegocio() { return nombreNegocio; }
    public void setNombreNegocio(String v) { this.nombreNegocio = v; }
    public String getTelefono() { return telefono; }
    public void setTelefono(String v) { this.telefono = v; }
    public String getWhatsapp() { return whatsapp; }
    public void setWhatsapp(String v) { this.whatsapp = v; }
    public String getDireccion() { return direccion; }
    public void setDireccion(String v) { this.direccion = v; }
    public String getCorreo() { return correo; }
    public void setCorreo(String v) { this.correo = v; }
    public String getHorarios() { return horarios; }
    public void setHorarios(String v) { this.horarios = v; }
    public String getInstagram() { return instagram; }
    public void setInstagram(String v) { this.instagram = v; }
    public String getFacebook() { return facebook; }
    public void setFacebook(String v) { this.facebook = v; }
    public String getTiktok() { return tiktok; }
    public void setTiktok(String v) { this.tiktok = v; }
    public int getPorcentajeIncremento() { return porcentajeIncremento; }
    public void setPorcentajeIncremento(int v) { this.porcentajeIncremento = v; }
    public long getCostoDomicilio() { return costoDomicilio; }
    public long getMetaVentasMes() { return metaVentasMes; }
    public void setMetaVentasMes(long v) { this.metaVentasMes = v; }
    public long getMetaUtilidadMes() { return metaUtilidadMes; }
    public void setMetaUtilidadMes(long v) { this.metaUtilidadMes = v; }
    public void setCostoDomicilio(long v) { this.costoDomicilio = v; }
    public long getEnvioGratisDesde() { return envioGratisDesde; }
    public void setEnvioGratisDesde(long v) { this.envioGratisDesde = v; }

    /** Valor del domicilio para un pedido con este subtotal. */
    public long domicilioPara(long subtotal) {
        return envioGratisDesde > 0 && subtotal >= envioGratisDesde ? 0 : costoDomicilio;
    }
    public boolean isCatalogoHabilitado() { return catalogoHabilitado; }
    public void setCatalogoHabilitado(boolean v) { this.catalogoHabilitado = v; }
    public boolean isMostrarAgotados() { return mostrarAgotados; }
    public void setMostrarAgotados(boolean v) { this.mostrarAgotados = v; }
    public String getNotasRecibo() { return notasRecibo; }
    public void setNotasRecibo(String v) { this.notasRecibo = v; }
    public boolean isReciboMostrarLogo() { return reciboMostrarLogo; }
    public void setReciboMostrarLogo(boolean v) { this.reciboMostrarLogo = v; }
    public boolean isReciboMostrarDireccion() { return reciboMostrarDireccion; }
    public void setReciboMostrarDireccion(boolean v) { this.reciboMostrarDireccion = v; }
    public boolean isReciboMostrarTelefono() { return reciboMostrarTelefono; }
    public void setReciboMostrarTelefono(boolean v) { this.reciboMostrarTelefono = v; }
    public boolean isReciboMostrarCliente() { return reciboMostrarCliente; }
    public void setReciboMostrarCliente(boolean v) { this.reciboMostrarCliente = v; }
    public String getLogoContentType() { return logoContentType; }
    public void setLogoContentType(String v) { this.logoContentType = v; }
    public byte[] getLogo() { return logo; }
    public void setLogo(byte[] v) { this.logo = v; }
}
