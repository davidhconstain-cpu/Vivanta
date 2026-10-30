package com.vivanet.beautystock.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import com.vivanet.beautystock.entity.Lote;

import jakarta.persistence.LockModeType;

public interface LoteRepository extends JpaRepository<Lote, Long> {

    /** Lotes con unidades, del mas antiguo al mas nuevo (orden PEPS), bloqueados para escritura. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from Lote l where l.producto.id = :productoId and l.cantidadDisponible > 0 order by l.fecha, l.id")
    List<Lote> disponiblesPeps(Long productoId);

    List<Lote> findByProductoIdOrderByFechaDescIdDesc(Long productoId);

    @Query("select coalesce(sum(l.cantidadDisponible), 0) from Lote l where l.producto.id = :productoId")
    long existencias(Long productoId);

    /** [productoId, unidades, valor al costo] de todos los productos. */
    @Query("select l.producto.id, sum(l.cantidadDisponible), sum(l.cantidadDisponible * l.costoUnitario) from Lote l group by l.producto.id")
    List<Object[]> existenciasPorProducto();
}
