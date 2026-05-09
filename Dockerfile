# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
RUN npm install -g pnpm
COPY frontend/package.json ./
RUN pnpm install
COPY frontend/ ./
RUN pnpm run build

# Stage 2: Build Spring Boot JAR
FROM maven:3.9-eclipse-temurin-17 AS backend-build
WORKDIR /app
COPY pom.xml ./
RUN mvn dependency:go-offline -q
COPY src ./src
COPY --from=frontend-build /app/frontend/dist ./src/main/resources/static/
RUN mvn package -DskipTests -q

# Stage 3: Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=backend-build /app/target/finpen-electricity-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
