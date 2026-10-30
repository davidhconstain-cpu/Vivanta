package com.vivanet.beautystock.service;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.vivanet.beautystock.dto.Dtos.CompraDto;
import com.vivanet.beautystock.dto.Dtos.CompraItemDto;
import com.vivanet.beautystock.dto.Dtos.CompraItemRequest;
import com.vivanet.beautystock.dto.Dtos.CompraRequest;
import com.vivanet.beautystock.dto.Dtos.PagoDto;
import com.vivanet.beautystock.dto.Dtos.PagoRequest;
import com.vivanet.beautystock.entity.Compra;
import com.vivanet.beautystock.entity.CompraItem;
import com.vivanet.beautystock.entity.MetodoPago;
import com.vivanet.beautystock.entity.PagoCompra;
import com.vivanet.beautystock.entity.Producto;
import com.vivanet.beautystock.entity.TipoMovimiento;
import com.vivanet.beautystock.repository.CompraRepository;

/** Entrada de mercancia: crea la compra, sus lotes y los pagos al proveedor. */
@Service
public class CompraService {

    private final CompraRepository compras;
    private final ProductoService productos;
    private final InventarioService inventario;
    private final ConsecutivoService consecutivos;

    public CompraService(CompraRepository compras, ProductoService productos, InventarioService inventario,
            ConsecutivoService consecutivos) {
        this.compras = compras;
        this.productos = productos;
        this.inventario = inventario;
        this.consecutivos = consecutivos;
    }

    @Transactional
    public CompraDto registrar(CompraRequest datos) {
        Compra compra = new Compra();
        compra.setNumero(consecutivos.siguiente("C"));
        compra.setFecha(datos.fecha() != null ? datos.fecha() : LocalDate.now());
        compra.setProveedor(textoOpcional(datos.proveedor()));
        compra.setCostosAdicionales(datos.costosAdicionales());
        compra.setNotaCostosAdicionales(textoOpcional(datos.notaCostosAdicionales()));
        compra.setFechaVencimiento(datos.fechaVencimiento());

        long total = 0;
        for (CompraItemRequest itemDatos : datos.items()) {
            Producto producto = productos.buscar(itemDatos.productoId());
            CompraItem item = new CompraItem(compra, producto, itemDatos.cantidad(), itemDatos.costoUnitario());
            compra.getItems().add(item);
            total += item.getSubtotal();

            // Cada linea de la compra es un lote nuevo con su propio costo.
            inventario.entrada(producto, itemDatos.cantidad(), itemDatos.costoUnitario(), TipoMovimiento.COMPRA,
                    compra.getNumero(), null);

            // El costo vigente es el de la compra mas reciente.
            producto.setCosto(itemDatos.costoUnitario());
            if (datos.actualizarPrecios()) {
                productos.cambiarPrecio(producto, productos.precioSugerido(itemDatos.costoUnitario()));
            }
        }
        compra.setTotal(total);

        if (datos.montoPagado() > total) {
            throw new NegocioException("El valor pagado no puede ser mayor que el total de la compra.");
        }
        compras.save(compra);
        if (datos.montoPagado() > 0) {
            agregarPago(compra, datos.montoPagado(), datos.metodoPago() != null ? datos.metodoPago() : MetodoPago.EFECTIVO);
        }
        return aDto(compra);
    }

    @Transactional
    public CompraDto abonar(Long compraId, PagoRequest pago) {
        Compra compra = buscar(compraId);
        if (pago.valor() > compra.getSaldo()) {
            throw new NegocioException("El abono supera el saldo pendiente de la compra.");
        }
        agregarPago(compra, pago.valor(), pago.metodo());
        return aDto(compra);
    }

    @Transactional(readOnly = true)
    public List<CompraDto> listar(boolean soloPendientes) {
        List<Compra> lista = soloPendientes ? compras.pendientesDePago() : compras.findAllByOrderByIdDesc();
        return lista.stream().map(this::aDto).toList();
    }

    @Transactional(readOnly = true)
    public CompraDto consultar(Long id) {
        return aDto(buscar(id));
    }

    private void agregarPago(Compra compra, long valor, MetodoPago metodo) {
        PagoCompra pago = new PagoCompra(consecutivos.siguiente("PP"), compra, valor, metodo);
        compra.getPagos().add(pago);
        compra.setPagado(compra.getPagado() + valor);
    }

    private Compra buscar(Long id) {
        return compras.findById(id).orElseThrow(() -> new NegocioException("Compra no encontrada."));
    }

    private CompraDto aDto(Compra c) {
        List<CompraItemDto> items = c.getItems().stream()
                .map(i -> new CompraItemDto(i.getProducto().getId(), i.getProducto().getCodigo(),
                        i.getProducto().getNombre(), i.getCantidad(), i.getCostoUnitario(), i.getSubtotal()))
                .toList();
        List<PagoDto> pagos = c.getPagos().stream()
                .map(p -> new PagoDto(p.getId(), p.getNumero(), p.getFecha(), p.getValor(), p.getMetodo(),
                        c.getNumero()))
                .toList();
        return new CompraDto(c.getId(), c.getNumero(), c.getFecha(), c.getProveedor(), c.getTotal(),
                c.getCostosAdicionales(), c.getNotaCostosAdicionales(), c.getPagado(), c.getSaldo(),
                c.getFechaVencimiento(), items, pagos);
    }

    static String textoOpcional(String texto) {
        return texto == null || texto.isBlank() ? null : texto.trim();
    }
}
