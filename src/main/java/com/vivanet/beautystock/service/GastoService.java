package com.vivanet.beautystock.service;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.vivanet.beautystock.dto.Dtos.GastoDto;
import com.vivanet.beautystock.dto.Dtos.GastoRecurrenteDto;
import com.vivanet.beautystock.dto.Dtos.GastoRecurrenteRequest;
import com.vivanet.beautystock.dto.Dtos.GastoRequest;
import com.vivanet.beautystock.dto.Dtos.GastosDto;
import com.vivanet.beautystock.dto.Dtos.PagarGastoRequest;
import com.vivanet.beautystock.dto.Dtos.RetiroDto;
import com.vivanet.beautystock.dto.Dtos.RetiroRequest;
import com.vivanet.beautystock.entity.Gasto;
import com.vivanet.beautystock.entity.GastoRecurrente;
import com.vivanet.beautystock.entity.Retiro;
import com.vivanet.beautystock.repository.GastoRecurrenteRepository;
import com.vivanet.beautystock.repository.GastoRepository;
import com.vivanet.beautystock.repository.RetiroRepository;

/**
 * Gastos generales, retiros del negocio y gastos recurrentes.
 *
 * Los gastos recurrentes no usan una tarea programada (que despertaria la base de datos de Neon
 * a cada rato): las repeticiones que ya toca pagar se crean como pendientes cuando se abre
 * el panel o la pantalla de gastos.
 */
@Service
public class GastoService {

    private final GastoRepository gastos;
    private final RetiroRepository retiros;
    private final GastoRecurrenteRepository recurrentes;

    public GastoService(GastoRepository gastos, RetiroRepository retiros, GastoRecurrenteRepository recurrentes) {
        this.gastos = gastos;
        this.retiros = retiros;
        this.recurrentes = recurrentes;
    }

    /** Todo lo de la pantalla de gastos para el rango (normalmente un mes). */
    @Transactional
    public GastosDto vista(LocalDate desde, LocalDate hasta) {
        generarPendientes();
        List<GastoDto> pagados = gastos.pagadosEntre(desde, hasta).stream().map(GastoService::aDto).toList();
        List<GastoDto> pendientes = pendientes();
        List<RetiroDto> listaRetiros = retiros.findByFechaBetweenOrderByFechaDescIdDesc(desde, hasta).stream()
                .map(GastoService::aDto).toList();
        return new GastosDto(pendientes, pagados, listaRetiros,
                recurrentes.findAllByOrderByActivoDescConceptoAsc().stream().map(GastoService::aDto).toList(),
                pagados.stream().mapToLong(GastoDto::valor).sum(),
                listaRetiros.stream().mapToLong(RetiroDto::valor).sum(),
                pendientes.stream().mapToLong(GastoDto::valor).sum());
    }

    /** Gastos sin pagar, el que vence primero arriba. */
    @Transactional(readOnly = true)
    public List<GastoDto> pendientes() {
        return gastos.findByPagadoFalseOrderByFechaAscIdAsc().stream().map(GastoService::aDto).toList();
    }

    /**
     * Crea como pendiente cada repeticion de los gastos recurrentes que vence en los proximos
     * tres dias (o que ya vencio y no se habia creado, por ejemplo si no se abrio la app en semanas).
     */
    @Transactional
    public void generarPendientes() {
        LocalDate limite = LocalDate.now().plusDays(GastoRecurrente.DIAS_DE_AVISO);
        for (GastoRecurrente r : recurrentes.activosBloqueados()) {
            while (!r.getProximaFecha().isAfter(limite)) {
                LocalDate fecha = r.getProximaFecha();
                if (!gastos.existsByRecurrenteIdAndFecha(r.getId(), fecha)) {
                    gastos.save(Gasto.pendienteDe(r, fecha));
                }
                r.avanzar();
            }
        }
    }

    // ---------- Gastos ----------

    @Transactional
    public GastoDto crearGasto(GastoRequest datos) {
        Gasto g = new Gasto(datos.fecha(), datos.concepto().trim(), datos.valor());
        if (datos.pagado()) {
            g.marcarPagado(datos.fecha(), datos.metodo());
        }
        return aDto(gastos.save(g));
    }

    @Transactional
    public GastoDto actualizarGasto(Long id, GastoRequest datos) {
        Gasto g = buscarGasto(id);
        g.setFecha(datos.fecha());
        g.setConcepto(datos.concepto().trim());
        g.setValor(datos.valor());
        if (datos.pagado()) {
            // Un gasto pagado se cuenta en la fecha en que salio la plata; si ya tenia una, se conserva.
            g.marcarPagado(g.isPagado() ? g.getFechaPago() : datos.fecha(), datos.metodo());
        } else {
            g.marcarPendiente();
        }
        return aDto(g);
    }

    @Transactional
    public GastoDto pagar(Long id, PagarGastoRequest datos) {
        Gasto g = buscarGasto(id);
        if (g.isPagado()) {
            throw new NegocioException("Este gasto ya está pagado.");
        }
        g.marcarPagado(datos.fechaPago(), datos.metodo());
        return aDto(g);
    }

    @Transactional
    public void eliminarGasto(Long id) {
        gastos.delete(buscarGasto(id));
    }

    // ---------- Retiros ----------

    @Transactional
    public RetiroDto crearRetiro(RetiroRequest datos) {
        Retiro r = new Retiro();
        copiar(datos, r);
        return aDto(retiros.save(r));
    }

    @Transactional
    public RetiroDto actualizarRetiro(Long id, RetiroRequest datos) {
        Retiro r = retiros.findById(id).orElseThrow(() -> new NegocioException("El retiro no existe."));
        copiar(datos, r);
        return aDto(r);
    }

    @Transactional
    public void eliminarRetiro(Long id) {
        retiros.delete(retiros.findById(id).orElseThrow(() -> new NegocioException("El retiro no existe.")));
    }

    // ---------- Gastos recurrentes ----------

    @Transactional
    public GastoRecurrenteDto crearRecurrente(GastoRecurrenteRequest datos) {
        if (datos.proximaFecha().isBefore(LocalDate.now())) {
            throw new NegocioException("La próxima fecha de pago no puede ser anterior a hoy. "
                    + "Si ya pagaste este mes, registra ese pago como un gasto normal y pon aquí el siguiente.");
        }
        GastoRecurrente r = new GastoRecurrente();
        r.reiniciar(datos.frecuencia(), datos.proximaFecha());
        copiar(datos, r);
        recurrentes.save(r);
        generarPendientes();
        return aDto(r);
    }

    @Transactional
    public GastoRecurrenteDto actualizarRecurrente(Long id, GastoRecurrenteRequest datos) {
        GastoRecurrente r = recurrentes.findById(id)
                .orElseThrow(() -> new NegocioException("El gasto recurrente no existe."));
        // Solo si cambia la frecuencia o la proxima fecha se vuelve a contar desde la fecha nueva.
        if (r.getFrecuencia() != datos.frecuencia() || !r.getProximaFecha().equals(datos.proximaFecha())) {
            if (datos.proximaFecha().isBefore(LocalDate.now())) {
                throw new NegocioException("La próxima fecha de pago no puede ser anterior a hoy.");
            }
            r.reiniciar(datos.frecuencia(), datos.proximaFecha());
        } else if (datos.activo() && !r.isActivo() && r.getProximaFecha().isBefore(LocalDate.now())) {
            // Al reactivarlo no se crean de golpe todas las repeticiones del tiempo en que estuvo apagado.
            throw new NegocioException("Para volver a activarlo, elige la próxima fecha de pago (desde hoy).");
        }
        copiar(datos, r);
        generarPendientes();
        return aDto(r);
    }

    /** Lo deja de repetir. Los gastos que ya creo (pagados o pendientes) se conservan. */
    @Transactional
    public void eliminarRecurrente(Long id) {
        GastoRecurrente r = recurrentes.findById(id)
                .orElseThrow(() -> new NegocioException("El gasto recurrente no existe."));
        gastos.soltarDeRecurrente(id);
        recurrentes.delete(r);
    }

    // ---------- Apoyo ----------

    private Gasto buscarGasto(Long id) {
        return gastos.findById(id).orElseThrow(() -> new NegocioException("El gasto no existe."));
    }

    private static void copiar(RetiroRequest datos, Retiro r) {
        r.setFecha(datos.fecha());
        r.setValor(datos.valor());
        r.setMotivo(datos.motivo().trim());
        r.setMetodo(datos.metodo());
    }

    private static void copiar(GastoRecurrenteRequest datos, GastoRecurrente r) {
        r.setConcepto(datos.concepto().trim());
        r.setValor(datos.valor());
        r.setActivo(datos.activo());
    }

    private static GastoDto aDto(Gasto g) {
        return new GastoDto(g.getId(), g.getFecha(), g.getConcepto(), g.getValor(), g.getMetodo(), g.isPagado(),
                g.getFechaPago(), g.getRecurrente() != null ? g.getRecurrente().getId() : null);
    }

    private static RetiroDto aDto(Retiro r) {
        return new RetiroDto(r.getId(), r.getFecha(), r.getValor(), r.getMotivo(), r.getMetodo());
    }

    private static GastoRecurrenteDto aDto(GastoRecurrente r) {
        return new GastoRecurrenteDto(r.getId(), r.getConcepto(), r.getValor(), r.getFrecuencia(),
                r.getProximaFecha(), r.isActivo());
    }
}
