package com.vivanet.beautystock.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Arma un archivo de Excel (.xlsx) sencillo sin librerias externas.
 *
 * Un .xlsx es un .zip con unos archivos XML adentro: uno por hoja, uno con la lista de hojas
 * y uno con los estilos (negrita y numeros con separador de miles). Aqui se escriben a mano.
 *
 * Uso: new Excel().hoja("Resumen", filas).hoja(...).bytes()
 * Cada fila es un arreglo de celdas: texto (String), numero (Long, Integer) o Excel.negrita("titulo").
 */
public class Excel {

    /** Texto que se muestra en negrita (titulos y encabezados). */
    public record Negrita(String texto) {
    }

    public static Negrita negrita(String texto) {
        return new Negrita(texto);
    }

    private record Hoja(String nombre, List<Object[]> filas) {
    }

    private final List<Hoja> hojas = new ArrayList<>();

    public Excel hoja(String nombre, List<Object[]> filas) {
        hojas.add(new Hoja(nombre, filas));
        return this;
    }

    public byte[] bytes() {
        ByteArrayOutputStream salida = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(salida)) {
            StringBuilder tipos = new StringBuilder("""
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\
                    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\
                    <Default Extension="xml" ContentType="application/xml"/>\
                    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>\
                    <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>""");
            StringBuilder libro = new StringBuilder("""
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" \
                    xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>""");
            StringBuilder relaciones = new StringBuilder("""
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">""");
            for (int i = 1; i <= hojas.size(); i++) {
                tipos.append("<Override PartName=\"/xl/worksheets/sheet").append(i)
                        .append(".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>");
                libro.append("<sheet name=\"").append(xml(nombreHoja(hojas.get(i - 1).nombre())))
                        .append("\" sheetId=\"").append(i).append("\" r:id=\"rId").append(i).append("\"/>");
                relaciones.append("<Relationship Id=\"rId").append(i)
                        .append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet")
                        .append(i).append(".xml\"/>");
                escribir(zip, "xl/worksheets/sheet" + i + ".xml", hoja(hojas.get(i - 1).filas()));
            }
            relaciones.append("<Relationship Id=\"rId").append(hojas.size() + 1)
                    .append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>")
                    .append("</Relationships>");
            escribir(zip, "[Content_Types].xml", tipos.append("</Types>").toString());
            escribir(zip, "_rels/.rels", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\
                    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\
                    </Relationships>""");
            escribir(zip, "xl/workbook.xml", libro.append("</sheets></workbook>").toString());
            escribir(zip, "xl/_rels/workbook.xml.rels", relaciones.toString());
            // Estilos: 0 = normal, 1 = numero con separador de miles, 2 = negrita
            escribir(zip, "xl/styles.xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\
                    <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>\
                    <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>\
                    <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>\
                    <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>\
                    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>\
                    <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>\
                    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>\
                    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>\
                    </styleSheet>""");
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return salida.toByteArray();
    }

    /** XML de una hoja, con el ancho de cada columna segun su texto mas largo. */
    private static String hoja(List<Object[]> filas) {
        int columnas = filas.stream().mapToInt(f -> f.length).max().orElse(0);
        int[] anchos = new int[columnas];
        StringBuilder datos = new StringBuilder();
        for (int r = 0; r < filas.size(); r++) {
            Object[] fila = filas.get(r);
            datos.append("<row r=\"").append(r + 1).append("\">");
            for (int c = 0; c < fila.length; c++) {
                Object valor = fila[c];
                if (valor == null) {
                    continue;
                }
                String ref = columna(c) + (r + 1);
                if (valor instanceof Number n) {
                    datos.append("<c r=\"").append(ref).append("\" s=\"1\"><v>").append(n.longValue()).append("</v></c>");
                    anchos[c] = Math.max(anchos[c], String.format("%,d", n.longValue()).length());
                } else {
                    boolean enNegrita = valor instanceof Negrita;
                    String texto = enNegrita ? ((Negrita) valor).texto() : String.valueOf(valor);
                    datos.append("<c r=\"").append(ref).append("\" t=\"inlineStr\"").append(enNegrita ? " s=\"2\"" : "")
                            .append("><is><t xml:space=\"preserve\">").append(xml(texto)).append("</t></is></c>");
                    // Los titulos sueltos (una sola celda en la fila) no ensanchan la columna.
                    if (fila.length > 1) {
                        anchos[c] = Math.max(anchos[c], texto.length());
                    }
                }
            }
            datos.append("</row>");
        }
        StringBuilder xml = new StringBuilder("""
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">""");
        if (columnas > 0) {
            xml.append("<cols>");
            for (int c = 0; c < columnas; c++) {
                int ancho = Math.min(60, Math.max(10, anchos[c] + 3));
                xml.append("<col min=\"").append(c + 1).append("\" max=\"").append(c + 1).append("\" width=\"")
                        .append(ancho).append("\" customWidth=\"1\"/>");
            }
            xml.append("</cols>");
        }
        return xml.append("<sheetData>").append(datos).append("</sheetData></worksheet>").toString();
    }

    /** 0 -> A, 25 -> Z, 26 -> AA ... */
    private static String columna(int indice) {
        StringBuilder letras = new StringBuilder();
        for (int n = indice + 1; n > 0; n = (n - 1) / 26) {
            letras.insert(0, (char) ('A' + (n - 1) % 26));
        }
        return letras.toString();
    }

    /** Excel no acepta nombres de hoja de mas de 31 letras ni con : \ / ? * [ ] */
    private static String nombreHoja(String nombre) {
        String limpio = nombre.replaceAll("[:\\\\/?*\\[\\]]", " ");
        return limpio.length() > 31 ? limpio.substring(0, 31) : limpio;
    }

    private static String xml(String texto) {
        return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private static void escribir(ZipOutputStream zip, String ruta, String contenido) throws IOException {
        zip.putNextEntry(new ZipEntry(ruta));
        zip.write(contenido.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}
