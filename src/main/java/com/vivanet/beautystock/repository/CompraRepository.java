package com.vivanet.beautystock.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.vivanet.beautystock.entity.Compra;

public interface CompraRepository extends JpaRepository<Compra, Long> {

    List<Compra> findAllByOrderByIdDesc();

    @Query("select c from Compra c where c.total > c.pagado order by c.fechaVencimiento nulls last, c.id")
    List<Compra> pendientesDePago();
}
