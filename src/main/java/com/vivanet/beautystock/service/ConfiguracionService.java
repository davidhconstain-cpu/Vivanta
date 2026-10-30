package com.vivanet.beautystock.service;

import java.io.IOException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.vivanet.beautystock.dto.Dtos.ConfiguracionDto;
import com.vivanet.beautystock.dto.Dtos.NegocioPublicoDto;
import com.vivanet.beautystock.entity.Configuracion;
import com.vivanet.beautystock.repository.ConfiguracionRepository;

@Service
public class ConfiguracionService {

    private final ConfiguracionRepository repositorio;

    public ConfiguracionService(ConfiguracionRepository repositorio) {
        this.repositorio = repositorio;
    }

    /** Devuelve la configuracion; la crea con valores iniciales la primera vez. */
    @Transactional
    public Configuracion obtener() {
        Configuracion c = repositorio.findById(1L).orElseGet(() -> repositorio.save(new Configuracion()));
        // La marca se llamaba "Vivanet" en el primer borrador; si nadie cambio el nombre, se actualiza.
        if ("Vivanet Colección".equals(c.getNombreNegocio())) {
            c.setNombreNegocio(Configuracion.NOMBRE_INICIAL);
        }
        return c;
    }

    @Transactional
    public ConfiguracionDto consultar() {
        return aDto(obtener());
    }

    @Transactional
    public ConfiguracionDto guardar(ConfiguracionDto datos) {
        Configuracion c = obtener();
        c.setNombreNegocio(datos.nombreNegocio());
        c.setTelefono(datos.telefono());
        c.setWhatsapp(datos.whatsapp());
        c.setDireccion(datos.direccion());
        c.setCorreo(datos.correo());
        c.setHorarios(datos.horarios());
        c.setInstagram(datos.instagram());
        c.setFacebook(datos.facebook());
        c.setTiktok(datos.tiktok());
        c.setPorcentajeIncremento(datos.porcentajeIncremento());
        c.setCostoDomicilio(datos.costoDomicilio());
        c.setMetaVentasMes(datos.metaVentasMes());
        c.setMetaUtilidadMes(datos.metaUtilidadMes());
        c.setCatalogoHabilitado(datos.catalogoHabilitado());
        c.setMostrarAgotados(datos.mostrarAgotados());
        c.setNotasRecibo(datos.notasRecibo());
        c.setReciboMostrarLogo(datos.reciboMostrarLogo());
        c.setReciboMostrarDireccion(datos.reciboMostrarDireccion());
        c.setReciboMostrarTelefono(datos.reciboMostrarTelefono());
        c.setReciboMostrarCliente(datos.reciboMostrarCliente());
        return aDto(c);
    }

    @Transactional
    public void guardarLogo(MultipartFile archivo) throws IOException {
        Configuracion c = obtener();
        c.setLogo(archivo.getBytes());
        c.setLogoContentType(archivo.getContentType());
    }

    @Transactional
    public NegocioPublicoDto negocioPublico() {
        Configuracion c = obtener();
        return new NegocioPublicoDto(c.getNombreNegocio(), c.getTelefono(), c.getWhatsapp(), c.getDireccion(),
                c.getCorreo(), c.getHorarios(), c.getInstagram(), c.getFacebook(), c.getTiktok(),
                c.getCostoDomicilio(), c.getLogoContentType() != null);
    }

    private ConfiguracionDto aDto(Configuracion c) {
        return new ConfiguracionDto(c.getNombreNegocio(), c.getTelefono(), c.getWhatsapp(), c.getDireccion(),
                c.getCorreo(), c.getHorarios(), c.getInstagram(), c.getFacebook(), c.getTiktok(),
                c.getPorcentajeIncremento(), c.getCostoDomicilio(), c.isCatalogoHabilitado(),
                c.isMostrarAgotados(), c.getNotasRecibo(), c.isReciboMostrarLogo(), c.isReciboMostrarDireccion(),
                c.isReciboMostrarTelefono(), c.isReciboMostrarCliente(), c.getLogoContentType() != null,
                c.getMetaVentasMes(), c.getMetaUtilidadMes());
    }

    /** Deja solo los digitos y agrega el indicativo de Colombia (57) si hace falta. */
    public static String telefonoWhatsapp(String telefono) {
        if (telefono == null) {
            return "";
        }
        String digitos = telefono.replaceAll("\\D", "");
        return digitos.length() == 10 ? "57" + digitos : digitos;
    }
}
