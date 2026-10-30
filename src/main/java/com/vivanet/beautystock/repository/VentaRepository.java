package com.vivanet.beautystock.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.vivanet.beautystock.entity.Venta;

public interface VentaRepository extends JpaRepository<Venta, Long> {

    @Query("select v from Venta v where v.fechaHora >= :desde and v.fechaHora < :hasta order by v.id desc")
    List<Venta> entreFechas(LocalDateTime desde, LocalDateTime hasta);

    List<Venta> findTop100ByOrderByIdDesc();

    List<Venta> findByClienteIdOrderByIdDesc(Long clienteId);

    @Query("select v from Venta v where v.estado = com.vivanet.beautystock.entity.EstadoVenta.ACTIVA and v.total > v.pagado order by v.fechaVencimiento nulls last, v.id")
    List<Venta> pendientesDeCobro();

    @Query("select v from Venta v where v.cliente.id = :clienteId and v.estado = com.vivanet.beautystock.entity.EstadoVenta.ACTIVA and v.total > v.pagado order by v.fechaHora, v.id")
    List<Venta> pendientesDelCliente(Long clienteId);

    /** [clienteId, saldo, ultima compra] por cliente. */
    @Query("select v.cliente.id, sum(case when v.estado = com.vivanet.beautystock.entity.EstadoVenta.ACTIVA then v.total - v.pagado else 0 end), max(v.fechaHora) from Venta v where v.cliente is not null group by v.cliente.id")
    List<Object[]> resumenPorCliente();
}
