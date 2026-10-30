package com.vivanet.beautystock.web;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.vivanet.beautystock.service.AdvertenciaException;
import com.vivanet.beautystock.service.NegocioException;

/** Convierte los errores en respuestas JSON {"mensaje": ...} que el navegador muestra. */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NegocioException.class)
    public ResponseEntity<Map<String, Object>> negocio(NegocioException e) {
        return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
    }

    /** 409: la operacion necesita que el usuario confirme las advertencias. */
    @ExceptionHandler(AdvertenciaException.class)
    public ResponseEntity<Map<String, Object>> advertencia(AdvertenciaException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("mensaje", e.getMessage(), "advertencias", e.getAdvertencias()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> ilegible(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest().body(Map.of("mensaje", "Los datos enviados no tienen el formato esperado."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> validacion(MethodArgumentNotValidException e) {
        String detalle = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b).orElse("Datos invalidos");
        return ResponseEntity.badRequest().body(Map.of("mensaje", "Revisa los datos. " + detalle));
    }
}
