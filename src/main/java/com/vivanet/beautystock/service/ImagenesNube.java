package com.vivanet.beautystock.service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Guarda las fotos en Cloudinary en lugar de la base de datos, para no gastar el espacio
 * ni la transferencia de Neon. Se activa con la variable CLOUDINARY_URL
 * (cloudinary://API_KEY:API_SECRET@NOMBRE_DE_LA_NUBE, tal como la muestra Cloudinary).
 * Sin esa variable, las fotos siguen guardandose en la base de datos.
 */
@Service
public class ImagenesNube {

    private static final Logger log = LoggerFactory.getLogger(ImagenesNube.class);
    private static final Pattern CONFIG = Pattern.compile("cloudinary://([^:]+):([^@]+)@(.+)");

    /** Lo que guardamos de cada foto subida. */
    public record Subida(String url, String publicId) {
    }

    /** Foto para entregar al navegador: o una direccion de Cloudinary o los bytes guardados en la base. */
    public record Foto(String url, String contentType, byte[] datos) {
    }

    private final String apiKey;
    private final String apiSecret;
    private final String nube;
    private final String carpetaBase;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    public ImagenesNube(@Value("${CLOUDINARY_URL:}") String configuracion,
            @Value("${CLOUDINARY_CARPETA:vivanta}") String carpetaBase) {
        this.carpetaBase = carpetaBase;
        Matcher m = CONFIG.matcher(configuracion.trim());
        if (m.matches()) {
            apiKey = m.group(1);
            apiSecret = m.group(2);
            nube = m.group(3);
            log.info("Fotos en Cloudinary (nube {}).", nube);
        } else {
            apiKey = apiSecret = nube = null;
            log.info("Sin CLOUDINARY_URL: las fotos se guardan en la base de datos.");
        }
    }

    public boolean activa() {
        return nube != null;
    }

    /** Sube la foto a la carpeta indicada ("productos" o "catalogo") dentro de la carpeta base. */
    public Subida subir(byte[] datos, String contentType, String carpeta) {
        Map<String, String> firmados = new TreeMap<>();
        firmados.put("folder", carpetaBase + "/" + carpeta);
        firmados.put("timestamp", String.valueOf(System.currentTimeMillis() / 1000));
        Map<String, String> campos = new LinkedHashMap<>(firmados);
        campos.put("api_key", apiKey);
        campos.put("signature", firma(firmados));
        campos.put("file", "data:" + contentType + ";base64," + Base64.getEncoder().encodeToString(datos));
        String respuesta = enviar("upload", campos);
        String url = campo(respuesta, "secure_url");
        String publicId = campo(respuesta, "public_id");
        if (url == null || publicId == null) {
            throw new NegocioException("No se pudo guardar la foto en Cloudinary. Intenta de nuevo.");
        }
        return new Subida(url, publicId);
    }

    /** Borra la foto de Cloudinary. Si falla solo se avisa en el registro: la foto ya no se muestra. */
    public void borrar(String publicId) {
        if (!activa() || publicId == null) {
            return;
        }
        try {
            Map<String, String> firmados = new TreeMap<>();
            firmados.put("public_id", publicId);
            firmados.put("timestamp", String.valueOf(System.currentTimeMillis() / 1000));
            Map<String, String> campos = new LinkedHashMap<>(firmados);
            campos.put("api_key", apiKey);
            campos.put("signature", firma(firmados));
            enviar("destroy", campos);
        } catch (RuntimeException e) {
            log.warn("No se pudo borrar {} de Cloudinary: {}", publicId, e.getMessage());
        }
    }

    /**
     * Direccion para mostrar la foto: Cloudinary la entrega en el formato mas liviano que
     * acepte el navegador, con calidad automatica y maximo 1000 px de ancho.
     */
    public static String paraMostrar(String url) {
        return url.replace("/image/upload/", "/image/upload/f_auto,q_auto,c_limit,w_1000/");
    }

    private String enviar(String accion, Map<String, String> campos) {
        String cuerpo = campos.entrySet().stream()
                .map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
        HttpRequest pedido = HttpRequest.newBuilder(URI.create("https://api.cloudinary.com/v1_1/" + nube + "/image/" + accion))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(cuerpo))
                .build();
        try {
            HttpResponse<String> r = http.send(pedido, HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() != 200) {
                log.warn("Cloudinary respondio {} a {}: {}", r.statusCode(), accion, r.body());
                throw new NegocioException("Cloudinary rechazó la foto (" + r.statusCode() + ").");
            }
            return r.body();
        } catch (IOException e) {
            throw new NegocioException("No hubo conexión con Cloudinary. Intenta de nuevo.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new NegocioException("Se interrumpió el envío a Cloudinary.");
        }
    }

    /** Firma de Cloudinary: SHA-1 de los parametros en orden alfabetico seguidos del secreto. */
    private String firma(Map<String, String> ordenados) {
        String texto = ordenados.entrySet().stream().map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("&")) + apiSecret;
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-1").digest(texto.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Lee un texto de la respuesta JSON de Cloudinary. */
    private static String campo(String json, String nombre) {
        Matcher m = Pattern.compile("\"" + nombre + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        return m.find() ? m.group(1).replace("\\/", "/") : null;
    }
}
