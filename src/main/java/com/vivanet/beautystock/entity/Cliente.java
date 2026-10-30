package com.vivanet.beautystock.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "clientes")
public class Cliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nombre;

    private String telefono;
    private String direccion;
    private String documento;

    /** Opcional. Al superarlo el sistema advierte, pero no bloquea la venta. */
    private Long limiteCredito;

    private LocalDateTime creadoEn = LocalDateTime.now();

    public Long getId() { return id; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getTelefono() { return telefono; }
    public void setTelefono(String telefono) { this.telefono = telefono; }
    public String getDireccion() { return direccion; }
    public void setDireccion(String direccion) { this.direccion = direccion; }
    public String getDocumento() { return documento; }
    public void setDocumento(String documento) { this.documento = documento; }
    public Long getLimiteCredito() { return limiteCredito; }
    public void setLimiteCredito(Long limiteCredito) { this.limiteCredito = limiteCredito; }
    public LocalDateTime getCreadoEn() { return creadoEn; }
}
