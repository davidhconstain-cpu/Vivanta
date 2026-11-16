package com.vivanet.beautystock.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.vivanet.beautystock.entity.Retiro;

public interface RetiroRepository extends JpaRepository<Retiro, Long> {

    List<Retiro> findByFechaBetweenOrderByFechaDescIdDesc(LocalDate desde, LocalDate hasta);

    /** [fecha, valor] de los retiros del rango, para los reportes. */
    @Query("select r.fecha, r.valor from Retiro r where r.fecha >= :desde and r.fecha <= :hasta")
    List<Object[]> totalesEntre(LocalDate desde, LocalDate hasta);
}
