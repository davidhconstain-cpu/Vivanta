package com.vivanet.beautystock.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.vivanet.beautystock.dto.Dtos.AjusteRequest;
import com.vivanet.beautystock.dto.Dtos.LoteDto;
import com.vivanet.beautystock.dto.Dtos.MovimientoDto;
import com.vivanet.beautystock.entity.ComboItem;
import com.vivanet.beautystock.entity.Lote;
import com.vivanet.beautystock.entity.MovimientoInventario;
import com.vivanet.beautystock.entity.Producto;
import com.vivanet.beautystock.entity.TipoMovimiento;
import com.vivanet.beautystock.repository.ComboItemRepository;
import com.vivanet.beautystock.repository.LoteRepository;
import com.vivanet.beautystock.repository.MovimientoInventarioRepository;
import com.vivanet.beautystock.repository.PedidoRepository;
import com.vivanet.beautystock.repository.ProductoRepository;

/**
 * Existencias por lotes y metodo PEPS (primero en entrar, primero en salir).
 * Es el unico lugar que modifica las cantidades de los lotes.
 */
@Service
public class InventarioService {

    /** Unidades tomadas de un lote durante una salida. */
    public record Consumo(Lote lote, int cantidad) {
        public long costo() {
            return cantidad * lote.getCostoUnitario();
        }
    }

    /** Existencias de un producto: fisicas, reservadas por pedidos y disponibles para vender. */
    public record Existencias(long fisicas, long valor, long reservadas, long disponibles) {
        public Existencias(long fisicas, long valor, long reservadas) {
            this(fisicas, valor, reservadas, Math.max(0, fisicas - reservadas));
        }
    }

    private final LoteRepository lotes;
    private final MovimientoInventarioRepository movimientos;
    private final PedidoRepository pedidos;
    private final ProductoRepository productos;
    private final ComboItemRepository combos;

    public InventarioService(LoteRepository lotes, MovimientoInventarioRepository movimientos,
            PedidoRepository pedidos, ProductoRepository productos, ComboItemRepository combos) {
        this.lotes = lotes;
        this.movimientos = movimientos;
        this.pedidos = pedidos;
        this.productos = productos;
        this.combos = combos;
    }

    /** Existencias de todos los productos en dos consultas, para listados. */
    @Transactional(readOnly = true)
    public Map<Long, Existencias> existenciasDeTodos() {
        Map<Long, long[]> datos = new HashMap<>();
        for (Object[] fila : lotes.existenciasPorProducto()) {
            datos.put((Long) fila[0], new long[] { numero(fila[1]), numero(fila[2]), 0 });
        }
        for (Object[] fila : pedidos.reservasPorProducto()) {
            datos.computeIfAbsent((Long) fila[0], k -> new long[3])[2] += numero(fila[1]);
        }
        // Un set pedido aparta tambien las unidades de sus productos.
        for (Object[] fila : pedidos.reservasPorSets()) {
            datos.computeIfAbsent((Long) fila[0], k -> new long[3])[2] += numero(fila[1]);
        }
        Map<Long, Existencias> resultado = new HashMap<>();
        datos.forEach((id, d) -> resultado.put(id, new Existencias(d[0], d[1], d[2])));
        return resultado;
    }

    /**
     * Como existenciasDeTodos, mas los sets: un set alcanza para tantas unidades como
     * permita su componente mas escaso. Sus reservadas son los sets pedidos y pendientes.
     */
    @Transactional(readOnly = true)
    public Map<Long, Existencias> existenciasConSets() {
        Map<Long, Existencias> base = existenciasDeTodos();
        Map<Long, Existencias> resultado = new HashMap<>(base);
        Map<Long, List<ComboItem>> porSet = new HashMap<>();
        for (ComboItem c : combos.todos()) {
            porSet.computeIfAbsent(c.getCombo().getId(), k -> new ArrayList<>()).add(c);
        }
        porSet.forEach((setId, componentes) -> {
            long fisicas = Long.MAX_VALUE;
            long disponibles = Long.MAX_VALUE;
            for (ComboItem c : componentes) {
                Existencias e = base.getOrDefault(c.getProducto().getId(), new Existencias(0, 0, 0));
                fisicas = Math.min(fisicas, e.fisicas() / c.getCantidad());
                disponibles = Math.min(disponibles, e.disponibles() / c.getCantidad());
            }
            Existencias propias = base.get(setId);
            resultado.put(setId, new Existencias(fisicas, 0, propias != null ? propias.reservadas() : 0, disponibles));
        });
        return resultado;
    }

    /** Unidades de un producto (no set) que se pueden vender o pedir: fisicas menos reservadas. */
    @Transactional(readOnly = true)
    public long disponibles(Long productoId) {
        return Math.max(0, lotes.existencias(productoId) - reservado(productoId));
    }

    /** Apartadas por pedidos pendientes, sueltas o dentro de sets. */
    private long reservado(Long productoId) {
        return pedidos.reservado(productoId) + pedidos.reservadoPorSets(productoId);
    }

    /** Crea un lote nuevo y registra el movimiento de entrada. */
    @Transactional
    public Lote entrada(Producto producto, int cantidad, long costoUnitario, TipoMovimiento tipo,
            String referencia, String motivo) {
        String origen = referencia != null ? referencia : "Ajuste";
        Lote lote = lotes.save(new Lote(producto, cantidad, costoUnitario, origen));
        movimientos.save(new MovimientoInventario(producto, tipo, cantidad, referencia, motivo));
        return lote;
    }

    /**
     * Saca unidades consumiendo primero los lotes mas antiguos.
     *
     * @param respetarReservas si es true, no permite tocar unidades reservadas por pedidos pendientes
     */
    @Transactional
    public List<Consumo> salidaPeps(Producto producto, int cantidad, TipoMovimiento tipo, String referencia,
            String motivo, boolean respetarReservas) {
        List<Lote> disponiblesPeps = lotes.disponiblesPeps(producto.getId());
        long fisicas = disponiblesPeps.stream().mapToLong(Lote::getCantidadDisponible).sum();
        long permitidas = respetarReservas ? fisicas - reservado(producto.getId()) : fisicas;
        if (cantidad > permitidas) {
            throw new NegocioException("Stock insuficiente de " + producto.getNombre() + ": hay "
                    + Math.max(0, permitidas) + " disponibles y se piden " + cantidad + ".");
        }

        List<Consumo> consumos = new ArrayList<>();
        int pendiente = cantidad;
        for (Lote lote : disponiblesPeps) {
            if (pendiente == 0) {
                break;
            }
            int tomar = Math.min(pendiente, lote.getCantidadDisponible());
            lote.setCantidadDisponible(lote.getCantidadDisponible() - tomar);
            consumos.add(new Consumo(lote, tomar));
            pendiente -= tomar;
        }
        movimientos.save(new MovimientoInventario(producto, tipo, -cantidad, referencia, motivo));
        return consumos;
    }

    /** Devuelve unidades a su lote original (por ejemplo, al anular una venta). */
    @Transactional
    public void devolver(Lote lote, int cantidad) {
        lote.setCantidadDisponible(lote.getCantidadDisponible() + cantidad);
    }

    @Transactional
    public void registrarMovimiento(Producto producto, TipoMovimiento tipo, int cantidad, String referencia,
            String motivo) {
        movimientos.save(new MovimientoInventario(producto, tipo, cantidad, referencia, motivo));
    }

    /** Ajuste manual: cantidad positiva suma unidades (al costo vigente), negativa las retira por PEPS. */
    @Transactional
    public void ajustar(AjusteRequest ajuste) {
        if (ajuste.cantidad() == 0) {
            throw new NegocioException("La cantidad del ajuste no puede ser cero.");
        }
        Producto producto = productos.findById(ajuste.productoId())
                .orElseThrow(() -> new NegocioException("Producto no encontrado."));
        if (producto.isCombo()) {
            throw new NegocioException("Un set no tiene existencias propias: ajusta los productos que incluye.");
        }
        String motivo = ajuste.motivo() == null || ajuste.motivo().isBlank() ? null : ajuste.motivo().trim();
        if (ajuste.cantidad() > 0) {
            entrada(producto, ajuste.cantidad(), producto.getCosto(), TipoMovimiento.AJUSTE_ENTRADA, null, motivo);
        } else {
            salidaPeps(producto, -ajuste.cantidad(), TipoMovimiento.AJUSTE_SALIDA, null, motivo, false);
        }
    }

    @Transactional(readOnly = true)
    public List<LoteDto> lotesDe(Long productoId) {
        return lotes.findByProductoIdOrderByFechaDescIdDesc(productoId).stream()
                .map(l -> new LoteDto(l.getId(), l.getFecha(), l.getOrigen(), l.getCantidadInicial(),
                        l.getCantidadDisponible(), l.getCostoUnitario()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MovimientoDto> movimientos(Long productoId) {
        List<MovimientoInventario> lista = productoId == null
                ? movimientos.findTop200ByOrderByFechaDescIdDesc()
                : movimientos.findByProductoIdOrderByFechaDescIdDesc(productoId);
        return lista.stream()
                .map(m -> new MovimientoDto(m.getId(), m.getFecha(), m.getProducto().getId(),
                        m.getProducto().getCodigo(), m.getProducto().getNombre(), m.getTipo(), m.getCantidad(),
                        m.getReferencia(), m.getMotivo()))
                .toList();
    }

    private static long numero(Object valor) {
        return valor == null ? 0 : ((Number) valor).longValue();
    }
}
