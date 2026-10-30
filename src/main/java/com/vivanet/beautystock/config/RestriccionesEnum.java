package com.vivanet.beautystock.config;

import java.util.Arrays;
import java.util.stream.Collectors;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.vivanet.beautystock.entity.EstadoPedido;
import com.vivanet.beautystock.entity.EstadoVenta;
import com.vivanet.beautystock.entity.FormaPagoPedido;
import com.vivanet.beautystock.entity.MetodoPago;
import com.vivanet.beautystock.entity.TipoDescuento;
import com.vivanet.beautystock.entity.TipoEntrega;
import com.vivanet.beautystock.entity.TipoMovimiento;

/**
 * Hibernate crea en PostgreSQL una regla (CHECK) con los valores que tenia cada enum
 * al crear la tabla, pero no la actualiza despues. Si agregamos un valor nuevo al enum
 * (por ejemplo ANULACION_COMPRA), la base de datos lo rechazaria.
 * Al arrancar, esta clase vuelve a crear cada regla con los valores actuales.
 */
@Component
public class RestriccionesEnum implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    public RestriccionesEnum(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        actualizar("movimientos_inventario", "tipo", TipoMovimiento.class);
        actualizar("pagos_compra", "metodo", MetodoPago.class);
        actualizar("pagos_venta", "metodo", MetodoPago.class);
        actualizar("pedidos", "estado", EstadoPedido.class);
        actualizar("pedidos", "tipo_entrega", TipoEntrega.class);
        actualizar("pedidos", "forma_pago", FormaPagoPedido.class);
        actualizar("ventas", "estado", EstadoVenta.class);
        actualizar("ventas", "descuento_tipo", TipoDescuento.class);
        actualizar("venta_items", "descuento_tipo", TipoDescuento.class);
    }

    private void actualizar(String tabla, String columna, Class<? extends Enum<?>> tipo) {
        String nombre = tabla + "_" + columna + "_check";
        String valores = Arrays.stream(tipo.getEnumConstants())
                .map(v -> "'" + v.name() + "'")
                .collect(Collectors.joining(", "));
        jdbc.execute("alter table " + tabla + " drop constraint if exists " + nombre);
        jdbc.execute("alter table " + tabla + " add constraint " + nombre
                + " check (" + columna + " in (" + valores + "))");
    }
}
