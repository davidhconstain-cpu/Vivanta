package com.vivanet.beautystock.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

/**
 * Quien puede entrar a que:
 * - El catalogo y su API (/catalogo, /api/public) son publicos.
 * - Todo lo demas exige iniciar sesion como administrador.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain seguridad(HttpSecurity http) throws Exception {
        http
                .authorizeHttpRequests(acceso -> acceso
                        .requestMatchers("/catalogo/**", "/api/public/**", "/css/**", "/img/**", "/login.html",
                                "/favicon.ico", "/error")
                        .permitAll()
                        .anyRequest().authenticated())
                .formLogin(login -> login
                        .loginPage("/login.html")
                        .loginProcessingUrl("/login")
                        .defaultSuccessUrl("/admin/", true)
                        .failureUrl("/login.html?error")
                        .permitAll())
                .logout(salida -> salida
                        .logoutUrl("/logout")
                        .logoutSuccessUrl("/login.html?salio"))
                // Para la API, si no hay sesion se responde 401 en vez de redirigir al login.
                .exceptionHandling(errores -> errores.defaultAuthenticationEntryPointFor(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                        PathPatternRequestMatcher.withDefaults().matcher("/api/**")))
                // La cookie de sesion es SameSite=Lax (ver application.properties),
                // lo que impide que otros sitios envien POST/PUT/DELETE con la sesion del administrador.
                .csrf(csrf -> csrf.disable());
        return http.build();
    }
}
