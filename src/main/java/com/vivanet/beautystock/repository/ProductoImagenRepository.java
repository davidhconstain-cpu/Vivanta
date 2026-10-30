package com.vivanet.beautystock.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.vivanet.beautystock.entity.ProductoImagen;

public interface ProductoImagenRepository extends JpaRepository<ProductoImagen, Long> {

    /** Solo id, producto y si es principal: no carga los bytes de la imagen. */
    @Query("select i.id, i.producto.id, i.principal from ProductoImagen i order by i.principal desc, i.id")
    List<Object[]> resumen();

    @Query("select count(i) from ProductoImagen i where i.producto.id = :productoId")
    long contarPorProducto(Long productoId);

    @Modifying
    @Query("update ProductoImagen i set i.principal = case when i.id = :imagenId then true else false end where i.producto.id = :productoId")
    void marcarPrincipal(Long productoId, Long imagenId);

    @Query("select min(i.id) from ProductoImagen i where i.producto.id = :productoId")
    Long primeraDelProducto(Long productoId);
}
