package com.vivanet.beautystock.service;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.vivanet.beautystock.entity.ImagenCatalogo;
import com.vivanet.beautystock.entity.ProductoImagen;
import com.vivanet.beautystock.repository.ImagenCatalogoRepository;
import com.vivanet.beautystock.repository.ProductoImagenRepository;

/**
 * Al arrancar con Cloudinary activo, copia alla las fotos que todavia estan solo en la base
 * de datos, una por una y en segundo plano (la app atiende normal mientras tanto).
 * Los bytes se dejan en la base hasta confirmar que todo se ve bien; luego se borran aparte.
 */
@Component
public class MigracionFotosNube {

    private static final Logger log = LoggerFactory.getLogger(MigracionFotosNube.class);

    private final ImagenesNube nube;
    private final ProductoImagenRepository fotosProducto;
    private final ImagenCatalogoRepository fotosCatalogo;
    private final TransactionTemplate transaccion;
    private final JdbcTemplate jdbc;

    public MigracionFotosNube(ImagenesNube nube, ProductoImagenRepository fotosProducto,
            ImagenCatalogoRepository fotosCatalogo, TransactionTemplate transaccion, JdbcTemplate jdbc) {
        this.nube = nube;
        this.fotosProducto = fotosProducto;
        this.fotosCatalogo = fotosCatalogo;
        this.transaccion = transaccion;
        this.jdbc = jdbc;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void alArrancar() {
        if (!nube.activa()) {
            return;
        }
        // Antes los bytes eran obligatorios en esta tabla; con Cloudinary quedan vacios.
        jdbc.execute("alter table imagenes_catalogo alter column datos drop not null");
        Thread hilo = new Thread(this::migrar, "fotos-a-cloudinary");
        hilo.setDaemon(true);
        hilo.start();
    }

    private void migrar() {
        List<Long> productos = fotosProducto.pendientesDeNube();
        List<Long> catalogo = fotosCatalogo.pendientesDeNube();
        if (productos.isEmpty() && catalogo.isEmpty()) {
            return;
        }
        log.info("Copiando a Cloudinary: {} fotos de productos y {} del catalogo.", productos.size(), catalogo.size());
        int listas = 0;
        int fallas = 0;
        for (Long id : productos) {
            try {
                ProductoImagen foto = transaccion.execute(t -> fotosProducto.findById(id).orElse(null));
                if (foto != null && foto.getDatos() != null) {
                    var subida = nube.subir(foto.getDatos(), foto.getContentType(), "productos");
                    transaccion.executeWithoutResult(t -> fotosProducto.pasarANube(id, subida.url(), subida.publicId()));
                    if (++listas % 25 == 0) {
                        log.info("Fotos copiadas: {} de {}.", listas, productos.size() + catalogo.size());
                    }
                }
            } catch (RuntimeException e) {
                fallas++;
                log.warn("No se pudo copiar la foto de producto {}: {}", id, e.getMessage());
            }
        }
        for (Long id : catalogo) {
            try {
                ImagenCatalogo foto = transaccion.execute(t -> fotosCatalogo.findById(id).orElse(null));
                if (foto != null && foto.getDatos() != null) {
                    var subida = nube.subir(foto.getDatos(), foto.getContentType(), "catalogo");
                    transaccion.executeWithoutResult(t -> fotosCatalogo.pasarANube(id, subida.url(), subida.publicId()));
                    listas++;
                }
            } catch (RuntimeException e) {
                fallas++;
                log.warn("No se pudo copiar la foto del catalogo {}: {}", id, e.getMessage());
            }
        }
        log.info("Copia a Cloudinary terminada: {} fotos copiadas, {} con error (se reintentan al reiniciar).", listas, fallas);
    }
}
