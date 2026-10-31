# Imagen para publicar BeautyStock en la nube (Render).
# Etapa 1: compila el proyecto con Maven y Java 21.
FROM maven:3.9.9-eclipse-temurin-21 AS compilacion
WORKDIR /app
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn -q -DskipTests package

# Etapa 2: solo lo necesario para ejecutar (imagen pequena).
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=compilacion /app/target/beautystock-*.jar app.jar
# El plan gratis de Render tiene 512 MB de memoria: limitamos Java para no pasarnos.
# Hora de Colombia: "hoy" (ofertas, ventas del dia, vencimientos) cambia a medianoche de aqui, no de Londres.
ENV JAVA_OPTS="-Xmx300m -Xss512k -XX:+UseSerialGC -XX:MaxMetaspaceSize=128m -Duser.timezone=America/Bogota"
EXPOSE 8080
CMD ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
