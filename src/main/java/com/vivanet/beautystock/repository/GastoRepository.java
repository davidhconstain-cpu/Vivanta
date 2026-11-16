package com.vivanet.beautystock.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.vivanet.beautystock.entity.Gasto;

public interface GastoRepository extends JpaRepository<Gasto, Long> {

    /** Gastos pagados en el rango (por fecha de pago), lo mas reciente primero. */
    @Query("select g from Gasto g where g.pagado = true and g.fechaPago >= :desde and g.fechaPago <= :hasta order by g.fechaPago desc, g.id desc")
    List<Gasto> pagadosEntre(LocalDate desde, LocalDate hasta);

    List<Gasto> findByPagadoFalseOrderByFechaAscIdAsc();

    boolean existsByRecurrenteIdAndFecha(Long recurrenteId, LocalDate fecha);

    /** [fechaPago, valor] de los gastos pagados del rango, para los reportes. */
    @Query("select g.fechaPago, g.valor from Gasto g where g.pagado = true and g.fechaPago >= :desde and g.fechaPago <= :hasta")
    List<Object[]> totalesEntre(LocalDate desde, LocalDate hasta);

    /** Al borrar un gasto recurrente, sus gastos ya creados se conservan sueltos. */
    @Modifying
    @Query("update Gasto g set g.recurrente = null where g.recurrente.id = :recurrenteId")
    void soltarDeRecurrente(Long recurrenteId);
}
