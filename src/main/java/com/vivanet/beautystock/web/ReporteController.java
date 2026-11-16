package com.vivanet.beautystock.web;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.vivanet.beautystock.dto.Dtos.ReporteDto;
import com.vivanet.beautystock.service.ReporteService;

/** Reportes de ventas, utilidad y compras (solo para el administrador, como todo /api). */
@RestController
@RequestMapping("/api/reportes")
public class ReporteController {

    private final ReporteService servicio;

    public ReporteController(ReporteService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public ReporteDto reporte(@RequestParam @DateTimeFormat(iso = ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = ISO.DATE) LocalDate hasta,
            @RequestParam(defaultValue = "DIA") String agrupar,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate compDesde,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate compHasta) {
        return servicio.reporte(desde, hasta, agrupar, compDesde, compHasta);
    }

    /** El mismo reporte como archivo de Excel para descargar. */
    @GetMapping("/excel")
    public ResponseEntity<byte[]> excel(@RequestParam @DateTimeFormat(iso = ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = ISO.DATE) LocalDate hasta,
            @RequestParam(defaultValue = "DIA") String agrupar,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate compDesde,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate compHasta) {
        byte[] archivo = servicio.excel(servicio.reporte(desde, hasta, agrupar, compDesde, compHasta));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("reporte-vivanta-" + desde + "-al-" + hasta + ".xlsx").build().toString())
                .body(archivo);
    }
}
