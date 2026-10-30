package com.vivanet.beautystock.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Permite abrir /admin/ y /catalogo/ sin escribir "index.html". */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registro) {
        registro.addRedirectViewController("/admin", "/admin/");
        registro.addViewController("/admin/").setViewName("forward:/admin/index.html");
        registro.addRedirectViewController("/catalogo", "/catalogo/");
        registro.addViewController("/catalogo/").setViewName("forward:/catalogo/index.html");
    }
}
