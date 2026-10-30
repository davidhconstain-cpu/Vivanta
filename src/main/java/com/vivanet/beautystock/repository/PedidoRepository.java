package com.vivanet.beautystock.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.vivanet.beautystock.entity.EstadoPedido;
import com.vivanet.beautystock.entity.Pedido;

public interface PedidoRepository extends JpaRepository<Pedido, Long> {

    List<Pedido> findTop200ByOrderByIdDesc();

    long countByEstado(EstadoPedido estado);

    /** Unidades reservadas por pedidos pendientes: [productoId, cantidad]. */
    @Query("select i.producto.id, sum(i.cantidad) from PedidoItem i where i.pedido.estado = com.vivanet.beautystock.entity.EstadoPedido.PENDIENTE group by i.producto.id")
    List<Object[]> reservasPorProducto();

    @Query("select coalesce(sum(i.cantidad), 0) from PedidoItem i where i.producto.id = :productoId and i.pedido.estado = com.vivanet.beautystock.entity.EstadoPedido.PENDIENTE")
    long reservado(Long productoId);
}
