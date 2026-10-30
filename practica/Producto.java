public class Producto {
    String nombre;
    String marca;
    double costo;
    double porcentajeGanancia;

    public Producto(String nombre, String marca, double costo, double porcentajeGanancia) {
        this.nombre = nombre;
        this.marca = marca;
        this.costo = costo;
        this.porcentajeGanancia = porcentajeGanancia;
    }
    public double calcularPrecioVenta() {
        return costo * (1 + porcentajeGanancia / 100);
    }
}
