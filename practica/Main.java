
import java.util.ArrayList;

public class Main {

    public static void main(String[] args) {

        ArrayList<Producto> inventario = new ArrayList<>();

        inventario.add(new Producto(
                "Crema hidratante", "Yanbal", 40000, 25));

        inventario.add(new Producto(
                "Perfume", "Natura", 25000, 30));

        inventario.add(new Producto(
                "Labial", "Ésika", 12000, 40));

        System.out.println("=== BEAUTYSTOCK ===");
        System.out.println("Productos registrados: "
                + inventario.size());
        System.out.println();

        for (Producto producto : inventario) {

            System.out.println("Producto: " + producto.nombre);
            System.out.println("Marca: " + producto.marca);
            System.out.println("Costo: $" + producto.costo);
            System.out.println("Precio sugerido: $"
                    + producto.calcularPrecioVenta());

            System.out.println("--------------------");
        }
    }
}