package com.vivanet.beautystock.web;

import java.net.URI;
import java.time.Duration;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import com.vivanet.beautystock.service.ImagenesNube.Foto;

/** Respuesta a un pedido de foto: si esta en Cloudinary el navegador va directo alla; si no, se envian los bytes. */
final class RespuestaFoto {

    private RespuestaFoto() {
    }

    static ResponseEntity<byte[]> de(Foto foto, Duration cache) {
        CacheControl control = CacheControl.maxAge(cache).cachePublic();
        if (foto.url() != null) {
            return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(foto.url())).cacheControl(control).build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(foto.contentType()))
                .cacheControl(control)
                .body(foto.datos());
    }
}
