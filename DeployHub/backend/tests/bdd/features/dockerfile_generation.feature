# Feature: Dockerfile Generation
# Describes what each generated Dockerfile must contain per framework

Feature: Dockerfile Generation

  Scenario: Vite app Dockerfile uses nginx with correct output dir
    Given I request a Dockerfile for framework "vite" with outputDir "dist"
    Then the Dockerfile should start with "FROM node"
    And the Dockerfile should contain "AS builder"
    And the Dockerfile should contain "FROM nginx:alpine AS runner"
    And the Dockerfile should contain "COPY --from=builder /app/dist /usr/share/nginx/html"
    And the Dockerfile should contain "EXPOSE 80"

  Scenario: CRA app Dockerfile copies build/ to nginx
    Given I request a Dockerfile for framework "cra" with outputDir "build"
    Then the Dockerfile should contain "COPY --from=builder /app/build /usr/share/nginx/html"

  Scenario: Next.js Dockerfile runs standalone node server
    Given I request a Dockerfile for framework "nextjs"
    Then the Dockerfile should contain ".next/standalone"
    And the Dockerfile should contain ".next/static"
    And the Dockerfile should contain the node server.js startup command
    And the Dockerfile should contain "EXPOSE 3000"

  Scenario: Nuxt Dockerfile runs node server
    Given I request a Dockerfile for framework "nuxt"
    Then the Dockerfile should contain "COPY --from=builder /app/.output ./"
    And the Dockerfile should contain the nuxt server startup command

  Scenario: Go Dockerfile uses exact build target from buildCommand
    Given I request a Dockerfile for framework "go" with buildCommand "CGO_ENABLED=0 GOOS=linux go build -o main ./cmd"
    Then the Dockerfile should contain "RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd"
    And the Dockerfile should NOT contain "./..."
    And the Dockerfile should contain "FROM alpine:latest"
    And the Dockerfile should contain "EXPOSE 8080"
    And the Dockerfile should contain the go binary startup command

  Scenario: FastAPI Dockerfile installs from requirements.txt
    Given I request a Dockerfile for framework "fastapi"
    Then the Dockerfile should contain "FROM python:3.11-slim"
    And the Dockerfile should contain "pip install --no-cache-dir -r requirements.txt"
    And the Dockerfile should contain "pip install --no-cache-dir uvicorn"
    And the Dockerfile should contain "EXPOSE 8000"

  Scenario: Flask Dockerfile uses gunicorn
    Given I request a Dockerfile for framework "flask"
    Then the Dockerfile should contain "FROM python:3.11-slim"
    And the Dockerfile should contain "gunicorn"
    And the Dockerfile should contain "EXPOSE 8000"

  Scenario: Rust Dockerfile builds release binary
    Given I request a Dockerfile for framework "rust" with entryPoint "my_server"
    Then the Dockerfile should contain "FROM rust:1.75-slim AS builder"
    And the Dockerfile should contain "cargo build --release"
    And the Dockerfile should contain "my_server"
    And the Dockerfile should contain "EXPOSE 8080"

  Scenario: Existing Dockerfile is not overwritten
    Given a repository already has a "Dockerfile"
    When I call generateDockerfile for framework "vite"
    Then the result should have generated equal to false
    And the existing Dockerfile should be unchanged

  Scenario: Node version is parameterised in Node.js templates
    Given I request a Dockerfile for framework "vite" with nodeVersion "18"
    Then the Dockerfile should contain "FROM node:18-alpine"
