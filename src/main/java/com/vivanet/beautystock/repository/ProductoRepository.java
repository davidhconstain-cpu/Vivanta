package com.vivanet.beautystock.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.vivanet.beautystock.entity.Producto;

public interface ProductoRepository extends JpaRepository<Producto, Long> {

    List<Producto> findAllByOrderByNombreAsc();

    List<Producto> findByActivoTrueOrderByNombreAsc();

    /** Veces que el producto aparece en lotes, movimientos, compras, ventas o pedidos. */
    @Query("""
            select (select count(l) from Lote l where l.producto.id = :id)
                 + (select count(m) from MovimientoInventario m where m.producto.id = :id)
                 + (select count(c) from CompraItem c where c.producto.id = :id)
                 + (select count(v) from VentaItem v where v.producto.id = :id)
                 + (select count(p) from PedidoItem p where p.producto.id = :id)
            from Producto x where x.id = :id""")
    long usos(Long id);

    @Modifying
    @Query("delete from ProductoImagen i where i.producto.id = :id")
    void borrarImagenes(Long id);

    @Modifying
    @Query("delete from HistorialPrecio h where h.producto.id = :id")
    void borrarHistorial(Long id);
}
