package com.vivanet.beautystock.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.vivanet.beautystock.entity.PagoVenta;

public interface PagoVentaRepository extends JpaRepository<PagoVenta, Long> {

    List<PagoVenta> findByVentaClienteIdOrderByFechaDesc(Long clienteId);
}
