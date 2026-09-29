# Design Platform Monorepo

## Project Overview

This repository houses the complete foundational architecture for a modern, web-based design platform built as a high-performance monorepo using **pnpm workspaces**, **Turborepo**, **TypeScript**, **Next.js**, and **Node.js (Fastify)**.

The platform architecture is decoupled so each application and shared package can be developed, tested, and deployed independently while sharing typed models, utilities, configurations, and component contracts.

---

## Architecture

```text
design-platform/
│
├── apps/
│   ├── web/          # Main customer-facing application (Next.js App Router, port 3000)
│   ├── admin/        # Administrative panel application (Next.js App Router, port 3001)
│   ├── super-admin/  # Platform management application (Next.js App Router, port 3002)
│   ├── api/          # High-performance Fastify backend service (port 4000)
│   └── worker/       # Standalone Node.js background worker process
│
├── packages/
│   ├── config/       # Shared TypeScript, ESLint, and Prettier configurations
│   ├── types/        # Shared domain and API contract types
│   ├── utils/        # Shared core helper functions
│   ├── ui/           # Shared UI component primitives
│   ├── editor/       # Canvas/editor contract and engine package
│   ├── api-client/   # Typed HTTP client for frontend applications
│   ├── auth/         # Shared authentication session and token types
│   ├── database/     # Database client abstraction layer
│   └── storage/      # Object storage abstraction layer (S3 / R2)
│
├── infrastructure/
│   ├── docker/       # Multi-stage Dockerfiles and docker-compose orchestration
│   ├── nginx/        # Reverse proxy and gateway configuration
│   └── scripts/      # Shell scripts for dev, build, and cleanup
│
├── .github/
│   └── workflows/    # GitHub Actions CI workflow
│
├── .env.example      # Master environment variable template
├── .gitignore        # Git ignore rules
├── package.json      # Workspace root configuration and scripts
├── pnpm-workspace.yaml# pnpm workspace definition
├── turbo.json        # Turborepo task pipeline configuration
├── tsconfig.json     # Workspace base TypeScript configuration
├── eslint.config.mjs # ESLint flat config
├── prettier.config.mjs# Code formatting rules
└── README.md         # Repository documentation
```

### apps/

- **`apps/web`** (Port: `3000`): The primary customer-facing web application built with Next.js App Router and React 19.
- **`apps/admin`** (Port: `3001`): Internal administrative panel built with Next.js App Router.
- **`apps/super-admin`** (Port: `3002`): Platform and system management application built with Next.js App Router.
- **`apps/api`** (Port: `4000`): Lightweight, high-throughput Node.js backend using Fastify and TypeScript.
- **`apps/worker`**: Independent Node.js + TypeScript worker process for handling background asynchronous jobs.

### packages/

- **`@design-platform/config`**: Centralized configuration presets (`base.json`, `nextjs.json`, `node.json`, ESLint, Prettier).
- **`@design-platform/types`**: Shared types including `ApiResponse<T>`, `HealthStatus`, and common entities.
- **`@design-platform/utils`**: Reusable utilities (`safeJsonParse`, `formatBytes`, `isDefined`, `sleep`).
- **`@design-platform/ui`**: Shared UI design components (e.g. `Button`).
- **`@design-platform/editor`**: Architecture foundation for the future design editor engine.
- **`@design-platform/api-client`**: Strongly-typed HTTP client wrapper used across frontend apps.
- **`@design-platform/auth`**: Shared authentication contracts and token definitions.
- **`@design-platform/database`**: Database driver connection interfaces and health status contracts.
- **`@design-platform/storage`**: Cloud storage driver abstractions (S3 / R2).

---

## Development & Usage

### Prerequisites

- **Node.js**: `>= 22.0.0`
- **pnpm**: `>= 11.0.0`

### How to Install

Install all dependencies across the entire monorepo:

```bash
pnpm install
```

### How to Run Development

Start all applications and services concurrently via Turborepo:

```bash
pnpm dev
```

Targeting individual applications:

```bash
# Start customer web app (port 3000)
pnpm --filter @design-platform/web dev

# Start admin panel (port 3001)
pnpm --filter @design-platform/admin dev

# Start super-admin panel (port 3002)
pnpm --filter @design-platform/super-admin dev

# Start Fastify backend (port 4000)
pnpm --filter @design-platform/api dev

# Start background worker
pnpm --filter @design-platform/worker dev
```

### How to Build

Build all packages and applications in dependency order:

```bash
pnpm build
```

### How to Lint

Run ESLint across all packages and applications:

```bash
pnpm lint
```

### How to Typecheck

Run TypeScript compilation check across all packages and applications without emitting files:

```bash
pnpm typecheck
```

### How to Format

Format and check code formatting with Prettier:

```bash
# Check code formatting
pnpm format:check

# Fix and write code formatting
pnpm format
```

---

## Adding New Packages & Applications

### How to Add a New Package

1. Create a directory in `packages/<package-name>`.
2. Initialize `package.json` with the scoped package name `@design-platform/<package-name>`:
   ```json
   {
     "name": "@design-platform/<package-name>",
     "version": "0.1.0",
     "private": true,
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "exports": {
       ".": {
         "types": "./src/index.ts",
         "default": "./src/index.ts"
       }
     },
     "scripts": {
       "build": "tsc",
       "typecheck": "tsc --noEmit",
       "lint": "eslint src"
     },
     "devDependencies": {
       "@design-platform/config": "workspace:*",
       "typescript": "^5.9.3",
       "eslint": "^9.39.5"
     }
   }
   ```
3. Create `tsconfig.json` extending `@design-platform/config/typescript/base.json`.
4. Run `pnpm install` at the monorepo root to link the new workspace package.

### How to Add a New Application

1. Create a directory in `apps/<app-name>`.
2. Define `package.json` using `@design-platform/<app-name>` and declare internal package dependencies via `workspace:*`:
   ```json
   {
     "dependencies": {
       "@design-platform/types": "workspace:*",
       "@design-platform/ui": "workspace:*"
     }
   }
   ```
3. Configure `tsconfig.json` extending `@design-platform/config/typescript/nextjs.json` (or `node.json`).
4. Assign a unique port in `package.json` dev script (e.g. `next dev -p 300X`).
5. Run `pnpm install` from the root.
