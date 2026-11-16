package com.vivanet.beautystock.service;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.vivanet.beautystock.entity.Administrador;
import com.vivanet.beautystock.repository.AdministradorRepository;

/**
 * Usuario administrador y su contrasena.
 *
 * La primera vez la contrasena es la de la variable ADMIN_PASSWORD (Render o local.properties).
 * Desde ahi se guarda cifrada en la base de datos y se puede cambiar desde el admin.
 * Llave de emergencia: si se cambia ADMIN_PASSWORD en Render, al arrancar la app toma esa
 * como la contrasena nueva (por si se olvido la que se puso en el admin).
 */
@Service
public class AdministradorService implements UserDetailsService, ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdministradorService.class);
    private static final int MINIMO = 8;
    /** BCrypt solo tiene en cuenta los primeros 72 bytes. */
    private static final int MAXIMO = 72;

    private final AdministradorRepository administradores;
    private final PasswordEncoder cifrado;
    private final FindByIndexNameSessionRepository<? extends Session> sesiones;
    private final String usuarioEntorno;
    private final String claveEntorno;

    public AdministradorService(AdministradorRepository administradores, PasswordEncoder cifrado,
            FindByIndexNameSessionRepository<? extends Session> sesiones,
            @Value("${ADMIN_USER:admin}") String usuarioEntorno, @Value("${ADMIN_PASSWORD}") String claveEntorno) {
        this.administradores = administradores;
        this.cifrado = cifrado;
        this.sesiones = sesiones;
        this.usuarioEntorno = usuarioEntorno.trim();
        this.claveEntorno = claveEntorno;
    }

    /** Al arrancar: crea el administrador o, si cambio ADMIN_PASSWORD, restablece la contrasena. */
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (claveEntorno == null || claveEntorno.isBlank()) {
            throw new IllegalStateException("Falta la variable ADMIN_PASSWORD.");
        }
        Administrador a = administradores.findFirstByOrderByIdAsc().orElse(null);
        if (a == null) {
            administradores.save(new Administrador(usuarioEntorno, cifrado.encode(claveEntorno), cifrado.encode(claveEntorno)));
            log.info("Administrador creado con la contraseña de ADMIN_PASSWORD.");
            return;
        }
        a.setUsuario(usuarioEntorno);
        if (!cifrado.matches(claveEntorno, a.getClaveEntornoHash())) {
            a.cambiarClave(cifrado.encode(claveEntorno));
            a.setClaveEntornoHash(cifrado.encode(claveEntorno));
            log.warn("ADMIN_PASSWORD cambió: la contraseña del administrador se restableció con ese valor.");
        }
    }

    /** Spring Security lo usa al iniciar sesion. */
    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String usuario) {
        Administrador a = administradores.findFirstByOrderByIdAsc()
                .filter(x -> x.getUsuario().equalsIgnoreCase(usuario.trim()))
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado"));
        return User.withUsername(a.getUsuario()).password(a.getClaveHash()).roles("ADMIN").build();
    }

    /**
     * Cambia la contrasena y cierra las sesiones abiertas en otros dispositivos
     * (la de este dispositivo sigue abierta). Devuelve cuantas sesiones cerro.
     */
    @Transactional
    public int cambiarClave(String usuario, String actual, String nueva, String confirmacion, String sesionActual) {
        Administrador a = administradores.findFirstByOrderByIdAsc()
                .filter(x -> x.getUsuario().equalsIgnoreCase(usuario))
                .orElseThrow(() -> new NegocioException("No se encontró el usuario."));
        if (actual == null || !cifrado.matches(actual, a.getClaveHash())) {
            throw new NegocioException("La contraseña actual no es correcta.");
        }
        if (nueva == null || nueva.length() < MINIMO) {
            throw new NegocioException("La contraseña nueva debe tener al menos " + MINIMO + " caracteres.");
        }
        if (nueva.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAXIMO) {
            throw new NegocioException("La contraseña nueva es demasiado larga (máximo " + MAXIMO + " caracteres).");
        }
        if (!nueva.equals(confirmacion)) {
            throw new NegocioException("La confirmación no coincide con la contraseña nueva.");
        }
        if (nueva.equals(actual)) {
            throw new NegocioException("La contraseña nueva debe ser distinta de la actual.");
        }
        a.cambiarClave(cifrado.encode(nueva));
        log.info("El administrador cambió su contraseña.");

        Map<String, ? extends Session> abiertas = sesiones.findByPrincipalName(a.getUsuario());
        int cerradas = 0;
        for (String id : abiertas.keySet()) {
            if (!id.equals(sesionActual)) {
                sesiones.deleteById(id);
                cerradas++;
            }
        }
        return cerradas;
    }
}
