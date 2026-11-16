package com.vivanet.beautystock.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import com.vivanet.beautystock.entity.GastoRecurrente;

import jakarta.persistence.LockModeType;

public interface GastoRecurrenteRepository extends JpaRepository<GastoRecurrente, Long> {

    List<GastoRecurrente> findAllByOrderByActivoDescConceptoAsc();

    /**
     * Los activos, bloqueados mientras dura la transaccion: si dos celulares abren el panel al mismo
     * tiempo, el segundo espera al primero y no se crea el mismo gasto pendiente dos veces.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from GastoRecurrente r where r.activo = true")
    List<GastoRecurrente> activosBloqueados();
}
