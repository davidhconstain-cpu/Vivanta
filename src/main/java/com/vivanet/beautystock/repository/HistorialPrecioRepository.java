package com.vivanet.beautystock.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.vivanet.beautystock.entity.HistorialPrecio;

public interface HistorialPrecioRepository extends JpaRepository<HistorialPrecio, Long> {

    List<HistorialPrecio> findByProductoIdOrderByFechaDesc(Long productoId);
}
