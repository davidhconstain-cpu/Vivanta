# BeautyStock · Guía rápida

## Cómo ejecutar

1. PostgreSQL debe estar encendido con la base `beautystock` (ya existe en este PC).
2. En la carpeta del proyecto:

   ```bash
   ./mvnw spring-boot:run
   ```

3. Abrir:
   - Administración: http://localhost:8080/admin/ (usuario `admin`; la contraseña está en `local.properties`, que no se sube a GitHub. Si clonas el proyecto en otro PC, copia `local.properties.example` como `local.properties` y llénalo)
   - Catálogo público: http://localhost:8080/catalogo/

Las tablas se crean solas (`spring.jpa.hibernate.ddl-auto=update`).

## Cómo está organizado el código

```
src/main/java/com/vivanet/beautystock/
├── entity/       Tablas de la base de datos (Producto, Lote, Compra, Venta, Pedido...)
├── repository/   Consultas a la base de datos (Spring Data JPA)
├── service/      Reglas del negocio (aquí está la lógica importante)
├── dto/          Datos que viajan como JSON entre navegador y servidor
├── web/          Controladores REST: las URLs /api/...
└── config/       Seguridad (login) y rutas de las páginas

src/main/resources/static/
├── css/estilos.css      Paleta y fuentes de Vivanta, modo claro/oscuro
├── img/                 Logo, isotipo y favicon de Vivanta
├── login.html           Inicio de sesión
├── admin/               Panel de administración (index.html + app.js) y recibo
└── catalogo/            Catálogo público con carrito y WhatsApp
```

El recorrido de una petición es siempre: **navegador → controlador (web) → servicio → repositorio → base de datos**.

## Reglas clave y dónde están

| Regla | Archivo |
|---|---|
| Lotes y PEPS (qué lote sale primero) | `service/InventarioService.java` → `salidaPeps` |
| Precio sugerido (+100 %, redondeo al millar) | `service/ProductoService.java` → `precioSugerido` |
| Venta: carrito, descuentos, crédito, advertencias, anulación | `service/VentaService.java` |
| Compra: lotes, costo vigente, pagos PP | `service/CompraService.java` |
| Pedidos del catálogo: reserva, confirmar → venta, cancelar | `service/PedidoService.java` |
| Consecutivos C-0001, V-0001, AC-0001, PP-0001, PED-0001, P-0001 | `service/ConsecutivoService.java` |
| Panel y alertas (stock bajo, vencimientos a 3 días) | `service/PanelService.java` |

## Pendiente (siguientes bloques del DDI)

- Corrección de una venta ya registrada (hoy se puede anular y volver a registrar).
- Recuperación de contraseña por correo, lista de sesiones activas.
- Reportes con exportación a Excel/PDF, metas mensuales, gastos y retiros.
- Alertas y resúmenes automáticos por WhatsApp (hoy se usan enlaces wa.me).
- Analítica del catálogo, carritos abandonados, operación sin conexión.
- Alojamiento en la nube y copias de seguridad.
