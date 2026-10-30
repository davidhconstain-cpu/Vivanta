package com.vivanet.beautystock.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.vivanet.beautystock.entity.MovimientoInventario;

public interface MovimientoInventarioRepository extends JpaRepository<MovimientoInventario, Long> {

    List<MovimientoInventario> findTop200ByOrderByFechaDescIdDesc();

    List<MovimientoInventario> findByProductoIdOrderByFechaDescIdDesc(Long productoId);
}
