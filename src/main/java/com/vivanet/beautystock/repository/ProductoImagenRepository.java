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
    /** Direccion en Cloudinary de la foto, sin cargar los bytes: [id, url] o vacio si no existe. */
    @Query("select i.id, i.url from ProductoImagen i where i.id = :id")
    List<Object[]> direccion(Long id);

    /** Fotos que todavia estan solo en la base de datos. */
    @Query("select i.id from ProductoImagen i where i.url is null and i.datos is not null order by i.id")
    List<Long> pendientesDeNube();

    @Modifying
    @Query("update ProductoImagen i set i.url = :url, i.publicId = :publicId where i.id = :id")
    void pasarANube(Long id, String url, String publicId);

    @Query("select i.publicId from ProductoImagen i where i.producto.id = :productoId and i.publicId is not null")
    List<String> publicIdsDeProducto(Long productoId);
}
