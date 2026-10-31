package com.vivanet.beautystock.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.vivanet.beautystock.dto.Dtos.PagoDto;
import com.vivanet.beautystock.dto.Dtos.PagoRequest;
import com.vivanet.beautystock.dto.Dtos.VentaDto;
import com.vivanet.beautystock.dto.Dtos.VentaItemDto;
import com.vivanet.beautystock.dto.Dtos.VentaItemRequest;
import com.vivanet.beautystock.dto.Dtos.VentaRequest;
import com.vivanet.beautystock.entity.Cliente;
import com.vivanet.beautystock.entity.ComboItem;
import com.vivanet.beautystock.entity.EstadoVenta;
import com.vivanet.beautystock.entity.MetodoPago;
import com.vivanet.beautystock.entity.PagoVenta;
import com.vivanet.beautystock.entity.Producto;
import com.vivanet.beautystock.entity.TipoDescuento;
import com.vivanet.beautystock.entity.TipoMovimiento;
import com.vivanet.beautystock.entity.Venta;
import com.vivanet.beautystock.entity.VentaItem;
import com.vivanet.beautystock.entity.VentaItemLote;
import com.vivanet.beautystock.repository.ClienteRepository;
import com.vivanet.beautystock.repository.ComboItemRepository;
import com.vivanet.beautystock.repository.VentaRepository;
import com.vivanet.beautystock.service.InventarioService.Consumo;

/** Ventas con carrito, descuentos, pagos, credito y anulacion. Descuenta inventario por PEPS. */
@Service
public class VentaService {

    private final VentaRepository ventas;
    private final ClienteRepository clientes;
    private final ProductoService productos;
    private final InventarioService inventario;
    private final ConsecutivoService consecutivos;
    private final ComboItemRepository combos;

    public VentaService(VentaRepository ventas, ClienteRepository clientes, ProductoService productos,
            InventarioService inventario, ConsecutivoService consecutivos, ComboItemRepository combos) {
        this.combos = combos;
        this.ventas = ventas;
        this.clientes = clientes;
        this.productos = productos;
        this.inventario = inventario;
        this.consecutivos = consecutivos;
    }

    @Transactional
    public VentaDto registrar(VentaRequest datos) {
        return aDto(crearVenta(datos, null, 0));
    }

    /**
     * Crea la venta. Si hay advertencias (venta bajo el costo, limite de credito)
     * y el usuario no las ha confirmado, lanza AdvertenciaException y todo se deshace.
     */
    @Transactional
    public Venta crearVenta(VentaRequest datos, String pedidoNumero, long cargoDomicilio) {
        Venta venta = new Venta();
        venta.setNumero(consecutivos.siguiente("V"));
        venta.setNotas(CompraService.textoOpcional(datos.notas()));
        venta.setFechaVencimiento(datos.fechaVencimiento());
        venta.setPedidoNumero(pedidoNumero);
        venta.setCargoDomicilio(cargoDomicilio);
        Cliente cliente = datos.clienteId() == null ? null : clientes.findById(datos.clienteId())
                .orElseThrow(() -> new NegocioException("Cliente no encontrado."));
        venta.setCliente(cliente);

        List<String> advertencias = new ArrayList<>();
        long subtotal = 0;
        long costoTotal = 0;

        for (VentaItemRequest itemDatos : datos.items()) {
            Producto producto = productos.buscar(itemDatos.productoId());
            if (!producto.isActivo()) {
                throw new NegocioException(producto.getNombre() + " esta desactivado.");
            }
            VentaItem item = new VentaItem(venta, producto, itemDatos.cantidad(), itemDatos.precioUnitario());
            long bruto = itemDatos.cantidad() * itemDatos.precioUnitario();
            long descuento = calcularDescuento(itemDatos.descuentoTipo(), itemDatos.descuentoValor(), bruto);
            item.setDescuentoTipo(itemDatos.descuentoTipo());
            item.setDescuentoValor(itemDatos.descuentoValor());
            item.setDescuento(descuento);
            item.setTotal(bruto - descuento);

            // Las unidades reservadas por pedidos pendientes no se pueden vender.
            // (Un pedido que se confirma deja de estar pendiente antes de llegar aqui.)
            // Un set saca del inventario las unidades de cada producto que incluye.
            List<Consumo> consumos = new ArrayList<>();
            if (producto.isCombo()) {
                for (ComboItem c : combos.deCombo(producto.getId())) {
                    consumos.addAll(inventario.salidaPeps(c.getProducto(), itemDatos.cantidad() * c.getCantidad(),
                            TipoMovimiento.VENTA, venta.getNumero(), "Set " + producto.getNombre(), true));
                }
            } else {
                consumos = inventario.salidaPeps(producto, itemDatos.cantidad(), TipoMovimiento.VENTA,
                        venta.getNumero(), null, true);
            }
            long costo = 0;
            for (Consumo consumo : consumos) {
                item.getLotes().add(new VentaItemLote(item, consumo.lote(), consumo.cantidad()));
                costo += consumo.costo();
            }
            item.setCosto(costo);
            if (item.getTotal() < costo) {
                advertencias.add(producto.getNombre() + " se vende por debajo del costo (costo " + Pesos.formato(costo)
                        + ", cobrado " + Pesos.formato(item.getTotal()) + ").");
            }
            venta.getItems().add(item);
            subtotal += item.getTotal();
            costoTotal += costo;
        }

        long descuentoGlobal = calcularDescuento(datos.descuentoTipo(), datos.descuentoValor(), subtotal);
        venta.setSubtotal(subtotal);
        venta.setDescuentoTipo(datos.descuentoTipo());
        venta.setDescuentoValor(datos.descuentoValor());
        venta.setDescuentoGlobal(descuentoGlobal);
        venta.setCostoTotal(costoTotal);
        long totalProductos = subtotal - descuentoGlobal;
        venta.setTotal(totalProductos + cargoDomicilio);
        venta.setUtilidad(totalProductos - costoTotal);
        if (advertencias.isEmpty() && totalProductos < costoTotal) {
            advertencias.add("Con el descuento, la venta queda por debajo del costo.");
        }

        if (datos.montoPagado() > venta.getTotal()) {
            throw new NegocioException("El valor pagado no puede ser mayor que el total de la venta.");
        }
        long queda = venta.getTotal() - datos.montoPagado();
        if (queda > 0 && cliente == null) {
            throw new NegocioException("Para una venta a credito o con pago parcial selecciona un cliente.");
        }
        if (queda > 0 && cliente.getLimiteCredito() != null) {
            long deudaActual = ventas.pendientesDelCliente(cliente.getId()).stream().mapToLong(Venta::getSaldo).sum();
            if (deudaActual + queda >= cliente.getLimiteCredito()) {
                advertencias.add(cliente.getNombre() + " alcanza o supera su límite de crédito ("
                        + Pesos.formato(cliente.getLimiteCredito()) + "): quedaría debiendo "
                        + Pesos.formato(deudaActual + queda) + ".");
            }
        }

        if (!advertencias.isEmpty() && !datos.confirmarAdvertencias()) {
            throw new AdvertenciaException(advertencias);
        }

        ventas.save(venta);
        if (datos.montoPagado() > 0) {
            agregarPago(venta, consecutivos.siguiente("AC"), datos.montoPagado(),
                    datos.metodoPago() != null ? datos.metodoPago() : MetodoPago.EFECTIVO);
        }
        return venta;
    }

    /** Anula la venta: devuelve las unidades a sus lotes originales y guarda el motivo. */
    @Transactional
    public VentaDto anular(Long id, String motivo) {
        Venta venta = buscar(id);
        anular(venta, motivo);
        return aDto(venta);
    }

    @Transactional
    public void anular(Venta venta, String motivo) {
        if (venta.getEstado() == EstadoVenta.ANULADA) {
            throw new NegocioException("La venta ya esta anulada.");
        }
        for (VentaItem item : venta.getItems()) {
            // Las unidades vuelven a sus lotes; el movimiento queda en cada producto
            // (en un set, en cada producto que incluia).
            Map<Producto, Integer> devueltas = new LinkedHashMap<>();
            for (VentaItemLote parte : item.getLotes()) {
                inventario.devolver(parte.getLote(), parte.getCantidad());
                devueltas.merge(parte.getLote().getProducto(), parte.getCantidad(), Integer::sum);
            }
            devueltas.forEach((producto, cantidad) -> inventario.registrarMovimiento(producto,
                    TipoMovimiento.ANULACION_VENTA, cantidad, venta.getNumero(), motivo));
        }
        venta.setEstado(EstadoVenta.ANULADA);
        venta.setMotivoAnulacion(motivo.trim());
        venta.setFechaAnulacion(LocalDateTime.now());
    }

    @Transactional
    public VentaDto abonar(Long id, PagoRequest pago) {
        Venta venta = buscar(id);
        if (venta.getEstado() == EstadoVenta.ANULADA) {
            throw new NegocioException("No se pueden registrar pagos en una venta anulada.");
        }
        if (pago.valor() > venta.getSaldo()) {
            throw new NegocioException("El abono supera el saldo pendiente de la venta.");
        }
        agregarPago(venta, consecutivos.siguiente("AC"), pago.valor(), pago.metodo());
        return aDto(venta);
    }

    /** Abono buscando al cliente: se aplica a sus deudas de la mas antigua a la mas nueva. */
    @Transactional
    public String abonarCliente(Long clienteId, PagoRequest pago) {
        List<Venta> pendientes = ventas.pendientesDelCliente(clienteId);
        long deuda = pendientes.stream().mapToLong(Venta::getSaldo).sum();
        if (deuda == 0) {
            throw new NegocioException("El cliente no tiene saldo pendiente.");
        }
        if (pago.valor() > deuda) {
            throw new NegocioException("El abono supera la deuda total del cliente (" + Pesos.formato(deuda) + ").");
        }
        String numero = consecutivos.siguiente("AC");
        long restante = pago.valor();
        for (Venta venta : pendientes) {
            if (restante == 0) {
                break;
            }
            long aplicar = Math.min(restante, venta.getSaldo());
            agregarPago(venta, numero, aplicar, pago.metodo());
            restante -= aplicar;
        }
        return numero;
    }

    @Transactional(readOnly = true)
    public List<VentaDto> listar(LocalDate desde, LocalDate hasta, boolean soloPendientes) {
        List<Venta> lista;
        if (soloPendientes) {
            lista = ventas.pendientesDeCobro();
        } else if (desde != null || hasta != null) {
            LocalDate inicio = desde != null ? desde : LocalDate.of(2000, 1, 1);
            LocalDate fin = hasta != null ? hasta : LocalDate.now();
            lista = ventas.entreFechas(inicio.atStartOfDay(), fin.plusDays(1).atStartOfDay());
        } else {
            lista = ventas.findTop100ByOrderByIdDesc();
        }
        return lista.stream().map(this::aDto).toList();
    }

    @Transactional(readOnly = true)
    public VentaDto consultar(Long id) {
        return aDto(buscar(id));
    }

    @Transactional(readOnly = true)
    public List<VentaDto> delCliente(Long clienteId) {
        return ventas.findByClienteIdOrderByIdDesc(clienteId).stream().map(this::aDto).toList();
    }

    private void agregarPago(Venta venta, String numero, long valor, MetodoPago metodo) {
        venta.getPagos().add(new PagoVenta(numero, venta, valor, metodo));
        venta.setPagado(venta.getPagado() + valor);
    }

    /** Porcentaje o valor fijo; nunca mayor que la base. */
    static long calcularDescuento(TipoDescuento tipo, long valor, long base) {
        if (tipo == null || valor <= 0) {
            return 0;
        }
        long descuento = tipo == TipoDescuento.PORCENTAJE ? Math.round(base * valor / 100.0) : valor;
        return Math.min(descuento, base);
    }

    private Venta buscar(Long id) {
        return ventas.findById(id).orElseThrow(() -> new NegocioException("Venta no encontrada."));
    }

    public VentaDto aDto(Venta v) {
        List<VentaItemDto> items = v.getItems().stream()
                .map(i -> new VentaItemDto(i.getProducto().getId(), i.getProducto().getCodigo(),
                        i.getProducto().getNombre(), i.getCantidad(), i.getPrecioLista(), i.getPrecioUnitario(),
                        i.getDescuento(), i.getTotal(), i.getCosto()))
                .toList();
        List<PagoDto> pagos = v.getPagos().stream()
                .map(p -> new PagoDto(p.getId(), p.getNumero(), p.getFecha(), p.getValor(), p.getMetodo(),
                        v.getNumero()))
                .toList();
        Cliente c = v.getCliente();
        return new VentaDto(v.getId(), v.getNumero(), v.getFechaHora(), c != null ? c.getId() : null,
                c != null ? c.getNombre() : null, c != null ? c.getTelefono() : null, v.getSubtotal(),
                v.getDescuentoGlobal(), v.getCargoDomicilio(), v.getTotal(), v.getCostoTotal(), v.getUtilidad(),
                v.getPagado(), v.getSaldo(), v.getFechaVencimiento(), v.getEstado().name(), v.getMotivoAnulacion(),
                v.getFechaAnulacion(), v.getNotas(), v.getPedidoNumero(), items, pagos);
    }
}
