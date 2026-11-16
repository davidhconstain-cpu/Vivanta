package com.vivanet.beautystock.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.vivanet.beautystock.entity.Administrador;

public interface AdministradorRepository extends JpaRepository<Administrador, Long> {

    /** Por ahora hay un solo administrador (primera etapa del DDI). */
    Optional<Administrador> findFirstByOrderByIdAsc();
}
