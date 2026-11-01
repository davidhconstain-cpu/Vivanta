package com.vivanet.beautystock.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.vivanet.beautystock.entity.Promocion;

public interface PromocionRepository extends JpaRepository<Promocion, Long> {

    List<Promocion> findAllByOrderByOrdenAscIdAsc();

    List<Promocion> findByActivaTrueOrderByOrdenAscIdAsc();
}
