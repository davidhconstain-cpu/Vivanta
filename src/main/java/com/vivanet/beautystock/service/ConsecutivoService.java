package com.vivanet.beautystock.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.vivanet.beautystock.entity.Consecutivo;
import com.vivanet.beautystock.repository.ConsecutivoRepository;

/** Genera numeros consecutivos como C-0001, V-0001, AC-0001... */
@Service
public class ConsecutivoService {

    private final ConsecutivoRepository repositorio;

    public ConsecutivoService(ConsecutivoRepository repositorio) {
        this.repositorio = repositorio;
    }

    /** El numero que se usaria a continuacion, solo para mostrarlo (no lo reserva). */
    @Transactional(readOnly = true)
    public String proximo(String prefijo) {
        int ultimo = repositorio.findById(prefijo).map(Consecutivo::getUltimo).orElse(0);
        return String.format("%s-%04d", prefijo, ultimo + 1);
    }

    /** Debe llamarse dentro de una transaccion para que el numero no se repita. */
    @Transactional(propagation = Propagation.MANDATORY)
    public String siguiente(String prefijo) {
        Consecutivo consecutivo = repositorio.bloquear(prefijo)
                .orElseGet(() -> repositorio.save(new Consecutivo(prefijo)));
        consecutivo.setUltimo(consecutivo.getUltimo() + 1);
        return String.format("%s-%04d", prefijo, consecutivo.getUltimo());
    }
}
