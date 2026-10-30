package com.vivanet.beautystock.service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.vivanet.beautystock.dto.Dtos.ClienteDetalleDto;
import com.vivanet.beautystock.dto.Dtos.ClienteDto;
import com.vivanet.beautystock.dto.Dtos.ClienteRequest;
import com.vivanet.beautystock.dto.Dtos.PagoDto;
import com.vivanet.beautystock.entity.Cliente;
import com.vivanet.beautystock.repository.ClienteRepository;
import com.vivanet.beautystock.repository.PagoVentaRepository;
import com.vivanet.beautystock.repository.VentaRepository;

@Service
public class ClienteService {

    private final ClienteRepository clientes;
    private final VentaRepository ventas;
    private final PagoVentaRepository pagos;
    private final VentaService ventaService;

    public ClienteService(ClienteRepository clientes, VentaRepository ventas, PagoVentaRepository pagos,
            VentaService ventaService) {
        this.clientes = clientes;
        this.ventas = ventas;
        this.pagos = pagos;
        this.ventaService = ventaService;
    }

    /** Busca por nombre, telefono o documento. */
    @Transactional(readOnly = true)
    public List<ClienteDto> listar(String texto) {
        Map<Long, Object[]> resumen = new HashMap<>();
        for (Object[] fila : ventas.resumenPorCliente()) {
            resumen.put((Long) fila[0], fila);
        }
        String buscado = ProductoService.normalizar(texto);
        return clientes.findAllByOrderByNombreAsc().stream()
                .filter(c -> buscado.isEmpty() || ProductoService.normalizar(
                        c.getNombre() + " " + nulo(c.getTelefono()) + " " + nulo(c.getDocumento())).contains(buscado))
                .map(c -> aDto(c, resumen.get(c.getId())))
                .toList();
    }

    @Transactional
    public ClienteDto crear(ClienteRequest datos) {
        Cliente c = new Cliente();
        copiar(datos, c);
        clientes.save(c);
        return aDto(c, null);
    }

    @Transactional
    public ClienteDto actualizar(Long id, ClienteRequest datos) {
        Cliente c = buscar(id);
        copiar(datos, c);
        return consultar(id);
    }

    @Transactional(readOnly = true)
    public ClienteDto consultar(Long id) {
        Cliente c = buscar(id);
        Object[] fila = ventas.resumenPorCliente().stream()
                .filter(f -> id.equals(f[0])).findFirst().orElse(null);
        return aDto(c, fila);
    }

    /** Historial comercial y financiero del cliente. */
    @Transactional(readOnly = true)
    public ClienteDetalleDto detalle(Long id) {
        List<PagoDto> historialPagos = pagos.findByVentaClienteIdOrderByFechaDesc(id).stream()
                .map(p -> new PagoDto(p.getId(), p.getNumero(), p.getFecha(), p.getValor(), p.getMetodo(),
                        p.getVenta().getNumero()))
                .toList();
        return new ClienteDetalleDto(consultar(id), ventaService.delCliente(id), historialPagos);
    }

    /** Busca un cliente por telefono o lo crea (pedidos del catalogo). */
    @Transactional
    public Cliente buscarOCrear(String nombre, String telefono, String direccion) {
        return clientes.findFirstByTelefono(telefono).orElseGet(() -> {
            Cliente c = new Cliente();
            c.setNombre(nombre);
            c.setTelefono(telefono);
            c.setDireccion(direccion);
            return clientes.save(c);
        });
    }

    private Cliente buscar(Long id) {
        return clientes.findById(id).orElseThrow(() -> new NegocioException("Cliente no encontrado."));
    }

    private void copiar(ClienteRequest datos, Cliente c) {
        c.setNombre(datos.nombre().trim());
        c.setTelefono(CompraService.textoOpcional(datos.telefono()));
        c.setDireccion(CompraService.textoOpcional(datos.direccion()));
        c.setDocumento(CompraService.textoOpcional(datos.documento()));
        c.setLimiteCredito(datos.limiteCredito() != null && datos.limiteCredito() > 0 ? datos.limiteCredito() : null);
    }

    private ClienteDto aDto(Cliente c, Object[] resumen) {
        long saldo = resumen != null && resumen[1] != null ? ((Number) resumen[1]).longValue() : 0;
        LocalDateTime ultima = resumen != null ? (LocalDateTime) resumen[2] : null;
        return new ClienteDto(c.getId(), c.getNombre(), c.getTelefono(), c.getDireccion(), c.getDocumento(),
                c.getLimiteCredito(), saldo, ultima);
    }

    private static String nulo(String texto) {
        return texto == null ? "" : texto;
    }
}
