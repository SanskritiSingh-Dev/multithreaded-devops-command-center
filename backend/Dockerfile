# Stage 1: Build the application using Maven Wrapper
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app

# Copy the entire backend directory (including .mvn and mvnw)
COPY . .

# Ensure maven wrapper is executable and limit memory to prevent OOM on Render Free Tier
RUN chmod +x ./mvnw
ENV MAVEN_OPTS="-Xmx256m"

# Build the application
RUN ./mvnw clean package -DskipTests

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
