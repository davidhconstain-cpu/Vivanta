package com.vivanet.beautystock.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import com.vivanet.beautystock.entity.Consecutivo;

import jakarta.persistence.LockModeType;

public interface ConsecutivoRepository extends JpaRepository<Consecutivo, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Consecutivo c where c.prefijo = :prefijo")
    Optional<Consecutivo> bloquear(String prefijo);
}
