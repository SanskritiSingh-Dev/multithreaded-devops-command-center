# Stage 1: Build the application using Maven image (avoids Windows line-ending issues)
FROM maven:3.9.6-eclipse-temurin-17-alpine AS build
WORKDIR /app

# Copy the pom.xml and source code
COPY pom.xml .
COPY src ./src

# Limit Maven memory to prevent OOM on Render Free Tier
ENV MAVEN_OPTS="-Xmx256m"

# Build the application
RUN mvn clean package -DskipTests

# Stage 2: Create the runtime image
FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app

# Copy the built JAR file from the 'build' stage
COPY --from=build /app/target/*.jar app.jar

# Limit Java runtime memory to prevent OOM crashes on Render Free Tier
ENV JAVA_OPTS="-Xmx300m"

# Expose port 8080
EXPOSE 8080

# Run the application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
