# Similarity App

Source-code similarity and plagiarism review platform for Brock University COSC 4P02.

## Services

- `apps/web`: Next.js frontend
- `apps/api`: NestJS + Fastify API
- `apps/worker`: BullMQ worker
- `engine/`: Rust GST-based comparison engine
- `prisma/`: schema, migrations, bootstrap, seed scripts

## Required Runtime Overview

- PostgreSQL
- Redis
- Filesystem-backed object storage volume for now
- Rust engine binary available to the worker

## Environment Setup

Copy `.env.example` to `.env` and set values appropriately.

Most important variables:

- `DATABASE_URL`
- `REDIS_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `ENGINE_BINARY_PATH`
- `OBJECT_STORAGE_ROOT`
- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`

## Database Commands

- Generate Prisma client:
  `npm run prisma:generate`
- Create/apply development migration:
  `npm run db:migrate:dev`
- Apply committed migrations in production:
  `npm run db:migrate:deploy`
- Bootstrap the first professor account:
  `npm run db:bootstrap-admin`
- Seed demo/dev data:
  `npm run db:seed`
- Reset local development database:
  `npm run db:reset:dev`

## Build Commands

- Build everything:
  `npm run build`
- Build engine tests:
  `cargo test --manifest-path engine/Cargo.toml --workspace`

## Run Commands

- API:
  `npm run start --workspace @similarity/api`
- Worker:
  `npm run start --workspace @similarity/worker`
- Web:
  `npm run start --workspace @similarity/web`

## Local Container Orchestration

Use:

`docker compose up --build`

This starts:

- `postgres`
- `redis`
- `api`
- `worker`
- `web`

The current deployment packaging uses filesystem-backed object storage mounted as a persistent Docker volume shared by API and worker.

## Deployment Bootstrap Order

1. Set environment variables.
2. Run `npm run prisma:generate`.
3. Run `npm run db:migrate:deploy`.
4. Run `npm run db:bootstrap-admin`.
5. Optionally run `npm run db:seed` in non-production environments.
6. Build and deploy web, api, worker, and engine.
7. Validate `/health/live` and `/health/ready`.
8. Validate login, assignment creation, upload preparation, comparison run, and pair viewer flow.
