# Multi-stage build so the shipped image only carries the runtime JRE and the
# built jar, not the full Maven/JDK toolchain used to produce it.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Railway injects PORT at runtime; application.properties already reads it
# via server.port=${PORT:8080}.
ENTRYPOINT ["java", "-jar", "app.jar"]
