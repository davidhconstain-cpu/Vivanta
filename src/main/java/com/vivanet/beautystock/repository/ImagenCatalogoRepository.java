package com.vivanet.beautystock.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.vivanet.beautystock.entity.ImagenCatalogo;

public interface ImagenCatalogoRepository extends JpaRepository<ImagenCatalogo, Long> {

    /** Direccion en Cloudinary de la foto, sin cargar los bytes: [id, url] o vacio si no existe. */
    @Query("select i.id, i.url from ImagenCatalogo i where i.id = :id")
    List<Object[]> direccion(Long id);

    /** Fotos que todavia estan solo en la base de datos. */
    @Query("select i.id from ImagenCatalogo i where i.url is null and i.datos is not null order by i.id")
    List<Long> pendientesDeNube();

    @Modifying
    @Query("update ImagenCatalogo i set i.url = :url, i.publicId = :publicId where i.id = :id")
    void pasarANube(Long id, String url, String publicId);
}
