package com.vivanet.beautystock.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.vivanet.beautystock.entity.ComboItem;

public interface ComboItemRepository extends JpaRepository<ComboItem, Long> {

    @Query("select c from ComboItem c where c.combo.id = :comboId order by c.id")
    List<ComboItem> deCombo(Long comboId);

    @Query("select c from ComboItem c order by c.combo.id, c.id")
    List<ComboItem> todos();

    @Modifying
    @Query("delete from ComboItem c where c.combo.id = :comboId")
    void borrarDeCombo(Long comboId);
}
