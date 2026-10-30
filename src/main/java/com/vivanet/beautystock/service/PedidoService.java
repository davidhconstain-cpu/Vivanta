package com.vivanet.beautystock.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.vivanet.beautystock.dto.Dtos.PedidoCreadoDto;
import com.vivanet.beautystock.dto.Dtos.PedidoDto;
import com.vivanet.beautystock.dto.Dtos.PedidoItemDto;
import com.vivanet.beautystock.dto.Dtos.PedidoItemRequest;
import com.vivanet.beautystock.dto.Dtos.PedidoRequest;
import com.vivanet.beautystock.dto.Dtos.VentaItemRequest;
import com.vivanet.beautystock.dto.Dtos.VentaRequest;
import com.vivanet.beautystock.entity.Cliente;
import com.vivanet.beautystock.entity.Configuracion;
import com.vivanet.beautystock.entity.EstadoPedido;
import com.vivanet.beautystock.entity.EstadoVenta;
import com.vivanet.beautystock.entity.FormaPagoPedido;
import com.vivanet.beautystock.entity.Pedido;
import com.vivanet.beautystock.entity.PedidoItem;
import com.vivanet.beautystock.entity.Producto;
import com.vivanet.beautystock.entity.TipoEntrega;
import com.vivanet.beautystock.entity.Venta;
import com.vivanet.beautystock.repository.PedidoRepository;

/**
 * Pedidos del catalogo publico. Un pedido PENDIENTE reserva unidades;
 * al CONFIRMARLO se crea la venta y al CANCELARLO se liberan.
 */
@Service
public class PedidoService {

    private final PedidoRepository pedidos;
    private final ProductoService productos;
    private final InventarioService inventario;
    private final VentaService ventas;
    private final ClienteService clientes;
    private final ConsecutivoService consecutivos;
    private final ConfiguracionService configuracion;

    public PedidoService(PedidoRepository pedidos, ProductoService productos, InventarioService inventario,
            VentaService ventas, ClienteService clientes, ConsecutivoService consecutivos,
            ConfiguracionService configuracion) {
        this.pedidos = pedidos;
        this.productos = productos;
        this.inventario = inventario;
        this.ventas = ventas;
        this.clientes = clientes;
        this.consecutivos = consecutivos;
        this.configuracion = configuracion;
    }

    /** Pedido enviado por un cliente desde el catalogo. */
    @Transactional
    public PedidoCreadoDto crear(PedidoRequest datos) {
        Configuracion config = configuracion.obtener();
        if (!config.isCatalogoHabilitado()) {
            throw new NegocioException("El catalogo esta en mantenimiento.");
        }
        if (config.getWhatsapp() == null || config.getWhatsapp().isBlank()) {
            throw new NegocioException("Por ahora no podemos recibir pedidos en línea. Intenta más tarde.");
        }
        if (datos.tipoEntrega() == TipoEntrega.DOMICILIO
                && (datos.direccion() == null || datos.direccion().isBlank())) {
            throw new NegocioException("La direccion es obligatoria para entrega a domicilio.");
        }

        Pedido pedido = new Pedido();
        pedido.setNumero(consecutivos.siguiente("PED"));
        pedido.setNombreCliente(datos.nombre().trim());
        pedido.setTelefono(datos.telefono().trim());
        pedido.setTipoEntrega(datos.tipoEntrega());
        pedido.setFormaPago(datos.formaPago() != null ? datos.formaPago() : FormaPagoPedido.CONTRA_ENTREGA);
        pedido.setDireccion(CompraService.textoOpcional(datos.direccion()));
        pedido.setObservaciones(CompraService.textoOpcional(datos.observaciones()));

        // Junta cantidades si el mismo producto viene repetido.
        Map<Long, Integer> cantidades = new HashMap<>();
        for (PedidoItemRequest item : datos.items()) {
            cantidades.merge(item.productoId(), item.cantidad(), Integer::sum);
        }
        long subtotal = 0;
        for (Map.Entry<Long, Integer> entrada : cantidades.entrySet()) {
            Producto producto = productos.buscar(entrada.getKey());
            if (!producto.isActivo()) {
                throw new NegocioException(producto.getNombre() + " ya no esta disponible.");
            }
            long disponibles = inventario.disponibles(producto.getId());
            if (entrada.getValue() > disponibles) {
                throw new NegocioException("Solo quedan " + disponibles + " unidades de " + producto.getNombre() + ".");
            }
            PedidoItem item = new PedidoItem(pedido, producto, entrada.getValue());
            pedido.getItems().add(item);
            subtotal += item.getTotal();
        }
        long domicilio = datos.tipoEntrega() == TipoEntrega.DOMICILIO ? config.getCostoDomicilio() : 0;
        pedido.setSubtotal(subtotal);
        pedido.setCostoDomicilio(domicilio);
        pedido.setTotal(subtotal + domicilio);
        pedidos.save(pedido);

        String url = "https://wa.me/" + ConfiguracionService.telefonoWhatsapp(config.getWhatsapp())
                + "?text=" + URLEncoder.encode(mensajeWhatsapp(pedido), StandardCharsets.UTF_8).replace("+", "%20");
        return new PedidoCreadoDto(pedido.getNumero(), pedido.getTotal(), url);
    }

    @Transactional
    public PedidoDto cambiarEstado(Long id, EstadoPedido nuevo) {
        Pedido pedido = pedidos.findById(id).orElseThrow(() -> new NegocioException("Pedido no encontrado."));
        EstadoPedido actual = pedido.getEstado();
        if (actual == nuevo) {
            return aDto(pedido);
        }
        if (actual == EstadoPedido.CANCELADO || actual == EstadoPedido.ENTREGADO) {
            throw new NegocioException("El pedido ya esta " + actual.name().toLowerCase() + ".");
        }
        if (nuevo == EstadoPedido.PENDIENTE) {
            throw new NegocioException("Un pedido no puede volver a pendiente.");
        }

        if (actual == EstadoPedido.PENDIENTE && nuevo != EstadoPedido.CANCELADO) {
            // Al confirmar: deja de reservar y se convierte en venta (pendiente de pago).
            pedido.setEstado(nuevo);
            pedidos.flush();
            Cliente cliente = clientes.buscarOCrear(pedido.getNombreCliente(), pedido.getTelefono(),
                    pedido.getDireccion());
            List<VentaItemRequest> items = pedido.getItems().stream()
                    .map(i -> new VentaItemRequest(i.getProducto().getId(), i.getCantidad(), i.getPrecioUnitario(),
                            null, 0))
                    .toList();
            VentaRequest venta = new VentaRequest(cliente.getId(), items, null, 0, 0, null, null,
                    pedido.getObservaciones(), true);
            pedido.setVenta(ventas.crearVenta(venta, pedido.getNumero(), pedido.getCostoDomicilio()));
        } else if (nuevo == EstadoPedido.CANCELADO) {
            // Si ya era venta, se anula y las unidades vuelven al inventario.
            Venta venta = pedido.getVenta();
            if (venta != null && venta.getEstado() == EstadoVenta.ACTIVA) {
                ventas.anular(venta, "Pedido " + pedido.getNumero() + " cancelado");
            }
            pedido.setEstado(nuevo);
        } else {
            pedido.setEstado(nuevo);
        }
        return aDto(pedido);
    }

    @Transactional(readOnly = true)
    public List<PedidoDto> listar() {
        return pedidos.findTop200ByOrderByIdDesc().stream().map(this::aDto).toList();
    }

    @Transactional(readOnly = true)
    public PedidoDto consultar(Long id) {
        return aDto(pedidos.findById(id).orElseThrow(() -> new NegocioException("Pedido no encontrado.")));
    }

    private String mensajeWhatsapp(Pedido p) {
        StringBuilder m = new StringBuilder();
        m.append("Hola, quiero hacer este pedido (").append(p.getNumero()).append("):\n\n");
        for (PedidoItem i : p.getItems()) {
            m.append("• ").append(i.getCantidad()).append(" x ").append(i.getProducto().getNombre())
                    .append(" — ").append(Pesos.formato(i.getTotal())).append("\n");
        }
        if (p.getCostoDomicilio() > 0) {
            m.append("• Domicilio — ").append(Pesos.formato(p.getCostoDomicilio())).append("\n");
        }
        m.append("\nTotal: ").append(Pesos.formato(p.getTotal())).append("\n");
        m.append("Nombre: ").append(p.getNombreCliente()).append("\n");
        m.append("Entrega: ").append(p.getTipoEntrega() == TipoEntrega.DOMICILIO ? "Domicilio" : "Recoger").append("\n");
        m.append("Pago: ").append(p.getFormaPago() == FormaPagoPedido.ANTICIPADO
                ? "Anticipado por transferencia o Nequi" : "Al recibir o recoger").append("\n");
        if (p.getDireccion() != null) {
            m.append("Dirección: ").append(p.getDireccion()).append("\n");
        }
        if (p.getObservaciones() != null) {
            m.append("Observaciones: ").append(p.getObservaciones()).append("\n");
        }
        return m.toString();
    }

    private PedidoDto aDto(Pedido p) {
        List<PedidoItemDto> items = p.getItems().stream()
                .map(i -> new PedidoItemDto(i.getProducto().getId(), i.getProducto().getNombre(), i.getCantidad(),
                        i.getPrecioUnitario(), i.getTotal()))
                .toList();
        return new PedidoDto(p.getId(), p.getNumero(), p.getFechaHora(), p.getNombreCliente(), p.getTelefono(),
                p.getTipoEntrega(), p.getFormaPago(), p.getDireccion(), p.getObservaciones(), p.getSubtotal(),
                p.getCostoDomicilio(),
                p.getTotal(), p.getEstado(), p.getVenta() != null ? p.getVenta().getId() : null,
                p.getVenta() != null ? p.getVenta().getNumero() : null, items);
    }
}
