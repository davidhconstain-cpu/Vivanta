package com.vivanet.beautystock.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.vivanet.beautystock.dto.Dtos.PeriodoReporteDto;
import com.vivanet.beautystock.dto.Dtos.ProductoReporteDto;
import com.vivanet.beautystock.dto.Dtos.ReporteDto;
import com.vivanet.beautystock.dto.Dtos.ResumenReporteDto;
import com.vivanet.beautystock.repository.CompraRepository;
import com.vivanet.beautystock.repository.VentaRepository;

/**
 * Reportes de ventas, utilidad y compras por dia, semana o mes, la comparacion con otro periodo
 * y lo vendido por producto (para los rankings).
 *
 * Se leen solo los numeros necesarios con dos consultas (lineas de venta y compras del rango)
 * y las cuentas se hacen aqui, en Java: asi la base de datos trabaja poco aunque el rango sea un año.
 */
@Service
public class ReporteService {

    private static final Locale ES = Locale.of("es", "CO");
    private static final DateTimeFormatter DIA = DateTimeFormatter.ofPattern("EEE d MMM", ES);
    private static final DateTimeFormatter DIA_CORTO = DateTimeFormatter.ofPattern("d MMM", ES);
    private static final DateTimeFormatter MES = DateTimeFormatter.ofPattern("MMMM yyyy", ES);
    /** Mas filas que esto no se leen bien (por ejemplo, dos años dia por dia). */
    private static final int MAXIMO_PERIODOS = 400;

    private final VentaRepository ventas;
    private final CompraRepository compras;

    public ReporteService(VentaRepository ventas, CompraRepository compras) {
        this.ventas = ventas;
        this.compras = compras;
    }

    /** Una linea de venta tal como llega de la base de datos (ver VentaRepository.lineasEntre). */
    private record Linea(long ventaId, LocalDate fecha, long totalVenta, long utilidadVenta, long domicilio,
            long subtotal, long descuentoGlobal, long productoId, String nombre, String marca, int cantidad,
            long totalLinea, long descuentoLinea, long costoLinea) {

        static Linea de(Object[] f) {
            return new Linea((Long) f[0], ((LocalDateTime) f[1]).toLocalDate(), (Long) f[2], (Long) f[3], (Long) f[4],
                    (Long) f[5], (Long) f[6], (Long) f[7], (String) f[8], (String) f[9], (Integer) f[10],
                    (Long) f[11], (Long) f[12], (Long) f[13]);
        }

        /** Lo que realmente se cobro por esta linea: su total menos su parte del descuento de toda la venta. */
        long cobrado() {
            long parteDescuento = subtotal > 0 ? Math.round((double) totalLinea * descuentoGlobal / subtotal) : 0;
            return totalLinea - parteDescuento;
        }
    }

    /** Compra tal como llega de la base de datos (ver CompraRepository.totalesEntre). */
    private record CompraFila(LocalDate fecha, long total, long adicionales) {
        static CompraFila de(Object[] f) {
            return new CompraFila((LocalDate) f[0], (Long) f[1], (Long) f[2]);
        }
    }

    @Transactional(readOnly = true)
    public ReporteDto reporte(LocalDate desde, LocalDate hasta, String agrupar, LocalDate compDesde, LocalDate compHasta) {
        if (desde == null || hasta == null) {
            throw new NegocioException("Elige la fecha inicial y la final del reporte.");
        }
        if (hasta.isBefore(desde)) {
            throw new NegocioException("La fecha final no puede ser anterior a la inicial.");
        }
        String grupo = switch (agrupar == null ? "DIA" : agrupar.toUpperCase()) {
            case "SEMANA" -> "SEMANA";
            case "MES" -> "MES";
            default -> "DIA";
        };
        // Si no se indica con que comparar, se usa el periodo anterior de la misma duracion.
        if (compDesde == null || compHasta == null || compHasta.isBefore(compDesde)) {
            long dias = ChronoUnit.DAYS.between(desde, hasta) + 1;
            compHasta = desde.minusDays(1);
            compDesde = compHasta.minusDays(dias - 1);
        }

        List<Linea> lineas = lineas(desde, hasta);
        List<CompraFila> filasCompras = compras(desde, hasta);

        return new ReporteDto(desde, hasta, grupo, resumen(lineas, filasCompras),
                compDesde, compHasta, resumen(lineas(compDesde, compHasta), compras(compDesde, compHasta)),
                periodos(desde, hasta, grupo, lineas, filasCompras), productos(lineas));
    }

    /** El mismo reporte en un archivo de Excel con tres hojas: Resumen, Por periodo y Productos. */
    public byte[] excel(ReporteDto r) {
        DateTimeFormatter fecha = DateTimeFormatter.ofPattern("dd/MM/yyyy");
        String rango = r.desde().format(fecha) + " al " + r.hasta().format(fecha);
        String rangoComp = r.compDesde().format(fecha) + " al " + r.compHasta().format(fecha);
        ResumenReporteDto a = r.resumen();
        ResumenReporteDto b = r.comparacion();

        List<Object[]> resumen = new ArrayList<>();
        resumen.add(new Object[] { Excel.negrita("Reporte del " + rango) });
        resumen.add(new Object[] {});
        resumen.add(new Object[] { Excel.negrita("Concepto"), Excel.negrita(rango), Excel.negrita(rangoComp),
                Excel.negrita("Diferencia"), Excel.negrita("Variación %") });
        resumen.add(comparar("Ventas", a.ventas(), b.ventas()));
        resumen.add(comparar("Utilidad estimada (PEPS)", a.utilidad(), b.utilidad()));
        resumen.add(comparar("Número de ventas", a.numeroVentas(), b.numeroVentas()));
        resumen.add(comparar("Unidades vendidas", a.unidades(), b.unidades()));
        resumen.add(comparar("Descuentos dados", a.descuentos(), b.descuentos()));
        resumen.add(comparar("Domicilios cobrados", a.domicilios(), b.domicilios()));
        resumen.add(comparar("Compras de mercancía", a.compras(), b.compras()));
        resumen.add(comparar("Costos adicionales de compras", a.costosAdicionales(), b.costosAdicionales()));
        resumen.add(comparar("Número de compras", a.numeroCompras(), b.numeroCompras()));
        resumen.add(new Object[] {});
        resumen.add(new Object[] { "Las ventas incluyen el domicilio cobrado; la utilidad no. Ventas anuladas no se cuentan." });

        List<Object[]> periodos = new ArrayList<>();
        periodos.add(new Object[] { Excel.negrita("Periodo"), Excel.negrita("Desde"), Excel.negrita("Hasta"),
                Excel.negrita("Ventas"), Excel.negrita("Utilidad"), Excel.negrita("N.º ventas"), Excel.negrita("Compras") });
        for (PeriodoReporteDto p : r.periodos()) {
            periodos.add(new Object[] { p.etiqueta(), p.desde().format(fecha), p.hasta().format(fecha), p.ventas(),
                    p.utilidad(), p.numeroVentas(), p.compras() });
        }
        periodos.add(new Object[] { Excel.negrita("Total"), null, null, a.ventas(), a.utilidad(), a.numeroVentas(), a.compras() });

        List<Object[]> productos = new ArrayList<>();
        productos.add(new Object[] { Excel.negrita("Producto"), Excel.negrita("Marca"), Excel.negrita("Unidades"),
                Excel.negrita("Ventas"), Excel.negrita("Utilidad"), Excel.negrita("Margen %") });
        for (ProductoReporteDto p : r.productos()) {
            productos.add(new Object[] { p.nombre(), p.marca(), p.unidades(), p.ventas(), p.utilidad(),
                    p.ventas() > 0 ? Math.round(p.utilidad() * 100.0 / p.ventas()) : 0 });
        }

        return new Excel().hoja("Resumen", resumen).hoja("Por periodo", periodos).hoja("Productos", productos).bytes();
    }

    private static Object[] comparar(String concepto, long actual, long anterior) {
        return new Object[] { concepto, actual, anterior, actual - anterior,
                anterior != 0 ? Math.round((actual - anterior) * 100.0 / Math.abs(anterior)) : null };
    }

    private List<Linea> lineas(LocalDate desde, LocalDate hasta) {
        return ventas.lineasEntre(desde.atStartOfDay(), hasta.plusDays(1).atStartOfDay()).stream()
                .map(Linea::de).toList();
    }

    private List<CompraFila> compras(LocalDate desde, LocalDate hasta) {
        return compras.totalesEntre(desde, hasta).stream().map(CompraFila::de).toList();
    }

    /**
     * Totales del rango. Los datos de la venta (total, utilidad, domicilio) se repiten en cada una
     * de sus lineas, por eso se suman una sola vez por venta.
     */
    private static ResumenReporteDto resumen(List<Linea> lineas, List<CompraFila> filasCompras) {
        long ventasTotal = 0, utilidad = 0, unidades = 0, descuentos = 0, domicilios = 0;
        Set<Long> vistas = new HashSet<>();
        for (Linea l : lineas) {
            unidades += l.cantidad();
            descuentos += l.descuentoLinea();
            if (vistas.add(l.ventaId())) {
                ventasTotal += l.totalVenta();
                utilidad += l.utilidadVenta();
                domicilios += l.domicilio();
                descuentos += l.descuentoGlobal();
            }
        }
        long comprasTotal = filasCompras.stream().mapToLong(CompraFila::total).sum();
        long adicionales = filasCompras.stream().mapToLong(CompraFila::adicionales).sum();
        return new ResumenReporteDto(ventasTotal, utilidad, vistas.size(), unidades, descuentos, domicilios,
                comprasTotal, adicionales, filasCompras.size());
    }

    /** Una fila por dia, semana (lunes a domingo) o mes, incluidos los que no tuvieron movimiento. */
    private static List<PeriodoReporteDto> periodos(LocalDate desde, LocalDate hasta, String grupo,
            List<Linea> lineas, List<CompraFila> filasCompras) {
        // Inicio de cada periodo -> acumulados [ventas, utilidad, numeroVentas, compras]
        Map<LocalDate, long[]> acumulados = new LinkedHashMap<>();
        for (LocalDate inicio = inicioDe(desde, grupo); !inicio.isAfter(hasta); inicio = siguiente(inicio, grupo)) {
            acumulados.put(inicio, new long[4]);
            if (acumulados.size() > MAXIMO_PERIODOS) {
                throw new NegocioException("Son demasiadas filas para ver día por día. Agrupa por semana o por mes.");
            }
        }
        Set<Long> vistas = new HashSet<>();
        for (Linea l : lineas) {
            if (vistas.add(l.ventaId())) {
                long[] a = acumulados.get(inicioDe(l.fecha(), grupo));
                a[0] += l.totalVenta();
                a[1] += l.utilidadVenta();
                a[2]++;
            }
        }
        for (CompraFila c : filasCompras) {
            acumulados.get(inicioDe(c.fecha(), grupo))[3] += c.total();
        }
        List<PeriodoReporteDto> lista = new ArrayList<>();
        acumulados.forEach((inicio, a) -> {
            // El primer y el ultimo periodo se recortan al rango pedido.
            LocalDate fin = siguiente(inicio, grupo).minusDays(1);
            LocalDate d = inicio.isBefore(desde) ? desde : inicio;
            LocalDate h = fin.isAfter(hasta) ? hasta : fin;
            lista.add(new PeriodoReporteDto(etiqueta(d, h, grupo), d, h, a[0], a[1], (int) a[2], a[3]));
        });
        return lista;
    }

    /** Lo vendido por producto, de mas a menos unidades. */
    private static List<ProductoReporteDto> productos(List<Linea> lineas) {
        // productoId -> [unidades, ventas, utilidad]
        Map<Long, long[]> acumulados = new LinkedHashMap<>();
        Map<Long, Linea> nombres = new LinkedHashMap<>();
        for (Linea l : lineas) {
            long[] a = acumulados.computeIfAbsent(l.productoId(), id -> new long[3]);
            long cobrado = l.cobrado();
            a[0] += l.cantidad();
            a[1] += cobrado;
            a[2] += cobrado - l.costoLinea();
            nombres.putIfAbsent(l.productoId(), l);
        }
        return acumulados.entrySet().stream()
                .map(e -> {
                    Linea l = nombres.get(e.getKey());
                    long[] a = e.getValue();
                    return new ProductoReporteDto(e.getKey(), l.nombre(), l.marca(), a[0], a[1], a[2]);
                })
                .sorted(Comparator.comparingLong(ProductoReporteDto::unidades).reversed()
                        .thenComparing(Comparator.comparingLong(ProductoReporteDto::ventas).reversed()))
                .toList();
    }

    private static LocalDate inicioDe(LocalDate fecha, String grupo) {
        return switch (grupo) {
            case "SEMANA" -> fecha.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case "MES" -> fecha.withDayOfMonth(1);
            default -> fecha;
        };
    }

    private static LocalDate siguiente(LocalDate inicio, String grupo) {
        return switch (grupo) {
            case "SEMANA" -> inicio.plusWeeks(1);
            case "MES" -> inicio.plusMonths(1);
            default -> inicio.plusDays(1);
        };
    }

    private static String etiqueta(LocalDate d, LocalDate h, String grupo) {
        String texto = switch (grupo) {
            case "SEMANA" -> d.equals(h) ? d.format(DIA_CORTO) : d.format(DIA_CORTO) + " – " + h.format(DIA_CORTO);
            case "MES" -> d.format(MES);
            default -> d.format(DIA);
        };
        return texto.replace(".", "").substring(0, 1).toUpperCase(ES) + texto.replace(".", "").substring(1);
    }
}
