# Feature: Framework Detection
# BDD scenarios describing the observable behaviour of the deployment router
# from a user's perspective: "When I push X, it should deploy to Y"

Feature: Framework Detection and Deployment Routing

  # ── Static frontends → S3 ─────────────────────────────────────────────────

  Scenario: Deploying a Vite React app routes to S3
    Given a repository containing a "package.json" with "vite" and "@vitejs/plugin-react" dependencies
    When the framework detector analyses the repository
    Then the detected framework should be "vite"
    And the deploy target should be "S3"
    And the output directory should be "dist"
    And isBackend should be false

  Scenario: Deploying a Vue 3 + Vite app routes to S3
    Given a repository containing a "package.json" with "vue" and "@vitejs/plugin-vue" dependencies
    When the framework detector analyses the repository
    Then the detected framework should be "vite"
    And the deploy target should be "S3"
    And isBackend should be false

  Scenario: Deploying a Vue CLI (Vue 2) app routes to S3
    Given a repository containing a "package.json" with "@vue/cli-service" dependency
    When the framework detector analyses the repository
    Then the detected framework should be "vite"
    And the deploy target should be "S3"
    And isBackend should be false

  Scenario: Deploying a Create React App routes to S3
    Given a repository containing a "package.json" with "react-scripts" dependency
    When the framework detector analyses the repository
    Then the detected framework should be "cra"
    And the deploy target should be "S3"
    And the output directory should be "build"

  Scenario: Deploying a static HTML site routes to S3
    Given a repository containing only an "index.html" file
    When the framework detector analyses the repository
    Then the detected framework should be "static"
    And the deploy target should be "S3"

  Scenario: Deploying a Gatsby site routes to S3
    Given a repository containing a "package.json" with "gatsby" dependency
    When the framework detector analyses the repository
    Then the detected framework should be "gatsby"
    And the deploy target should be "S3"
    And the output directory should be "public"

  Scenario: Deploying an Astro site routes to S3
    Given a repository containing a "package.json" with "astro" dependency
    When the framework detector analyses the repository
    Then the detected framework should be "astro"
    And the deploy target should be "S3"

  # ── SSR frameworks → EC2 (critical fixes) ────────────────────────────────

  Scenario: Deploying a Next.js app routes to EC2 not S3
    Given a repository containing a "package.json" with "next" dependency
    When the framework detector analyses the repository
    Then the detected framework should be "nextjs"
    And the deploy target should be "EC2"
    And isBackend should be true
    And the start command should be "node server.js"

  Scenario: Deploying a Nuxt app routes to EC2 not S3
    Given a repository containing a "package.json" with "nuxt" dependency
    When the framework detector analyses the repository
    Then the detected framework should be "nuxt"
    And the deploy target should be "EC2"
    And isBackend should be true
    And the start command should be "node server/index.mjs"

  Scenario: Deploying a SvelteKit SSR app routes to EC2
    Given a repository containing a "package.json" with "@sveltejs/kit" dependency but no static adapter
    When the framework detector analyses the repository
    Then the detected framework should be "sveltekit"
    And the deploy target should be "EC2"
    And isBackend should be true

  Scenario: Deploying a SvelteKit static app routes to S3
    Given a repository containing a "package.json" with "@sveltejs/kit" and "@sveltejs/adapter-static" dependencies
    When the framework detector analyses the repository
    Then the detected framework should be "sveltekit-static"
    And the deploy target should be "S3"
    And isBackend should be false

  # ── Backend services → EC2 ────────────────────────────────────────────────

  Scenario: Deploying an Express API routes to EC2
    Given a repository containing a "package.json" with "express" dependency
    When the framework detector analyses the repository
    Then the detected framework should be "node-backend"
    And the deploy target should be "EC2"
    And isBackend should be true

  Scenario: Deploying a FastAPI service routes to EC2
    Given a repository with "requirements.txt" containing "fastapi" and "main.py"
    When the framework detector analyses the repository
    Then the detected framework should be "fastapi"
    And the deploy target should be "EC2"
    And the port should be 8000
    And the start command should contain "uvicorn"

  Scenario: Deploying a Flask service routes to EC2
    Given a repository with "requirements.txt" containing "Flask" and "app.py"
    When the framework detector analyses the repository
    Then the detected framework should be "flask"
    And the deploy target should be "EC2"
    And the port should be 8000

  Scenario: Deploying a Django service routes to EC2
    Given a repository with "requirements.txt" containing "Django"
    When the framework detector analyses the repository
    Then the detected framework should be "django"
    And the deploy target should be "EC2"
    And the build command should contain "collectstatic"

  # ── Go: nested main package ───────────────────────────────────────────────

  Scenario: Deploying a Go app with main package in ./cmd subdirectory
    Given a Go repository with "go.mod" and main package in "cmd/main.go"
    When the framework detector analyses the repository
    Then the detected framework should be "go"
    And the deploy target should be "EC2"
    And the goMainPkg should be "cmd"
    And the build command should be "CGO_ENABLED=0 GOOS=linux go build -o main ./cmd"
    And the build command should NOT contain "./..."

  Scenario: Go build command never uses ./... to prevent multi-package error
    Given a Go repository with multiple packages and main in "cmd/"
    When the Dockerfile is generated for this project
    Then the Dockerfile RUN build line should contain "./cmd"
    And the Dockerfile RUN build line should NOT contain "./..."

  # ── Rust ─────────────────────────────────────────────────────────────────

  Scenario: Deploying a Rust service routes to EC2
    Given a repository with "Cargo.toml" defining package name "my_server"
    When the framework detector analyses the repository
    Then the detected framework should be "rust"
    And the deploy target should be "EC2"
    And the entry point should be "my_server"
    And the port should be 8080

  # ── Monorepo / subdirectory ───────────────────────────────────────────────

  Scenario: Detecting a project in a subdirectory of a monorepo
    Given a monorepo with an Express API in the "api/" subdirectory
    When the framework detector analyses the root repository
    Then the detected framework should be "node-backend"
    And the project root should point to the "api" subdirectory

  # ── Config override ───────────────────────────────────────────────────────

  Scenario: deployhub.json config overrides auto-detection
    Given a repository containing both a "deployhub.json" and a "package.json" with "vite"
    And the "deployhub.json" specifies framework "docker" and isBackend true
    When the framework detector analyses the repository
    Then the detected framework should be "docker"
    And the detection method should be "config"
