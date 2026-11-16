package com.vivanet.beautystock.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.vivanet.beautystock.entity.Compra;

public interface CompraRepository extends JpaRepository<Compra, Long> {

    List<Compra> findAllByOrderByIdDesc();

    @Query("select c from Compra c where c.anulada = false and c.total > c.pagado order by c.fechaVencimiento nulls last, c.id")
    List<Compra> pendientesDePago();

    /** [fecha, total, costosAdicionales] de las compras no anuladas del rango (ambas fechas incluidas), para los reportes. */
    @Query("select c.fecha, c.total, c.costosAdicionales from Compra c where c.anulada = false and c.fecha >= :desde and c.fecha <= :hasta")
    List<Object[]> totalesEntre(LocalDate desde, LocalDate hasta);
}
