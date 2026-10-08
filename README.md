# Shoebox

Shoebox is the photo and video gallery for Model United Nations conferences, built by the German non-profit [Deutsche Model United Nations (DMUN) e.V.](https://dmun.de). Team members and photographers upload media into conference albums, the public browses what is public, and the team sees the rest.

> The gallery, the upload and manage screens for photographers and the admin area are in place. Video support is not.

## Architecture

```
Browser ──► apps/server  (SvelteKit, Node)            ──► PostgreSQL
              ├─ GraphQL /api/graphql (Rumble/Pothos/Yoga)      ▲
              ├─ OIDC login (@m1212e/sveltekit-oidc)            │ processing_job table
              └─ presigned S3 URLs                              │ (SKIP LOCKED + NOTIFY)
                     │                                          ▼
                     ▼                                  apps/processor (Bun)
            S3-compatible object store  ◄───────────── sharp · ffmpeg · blurhash
              ├─ originals   (private, presigned GET)
              └─ derivatives (public, served from PUBLIC_MEDIA_BASE_URL)
```

Two Docker images are published from this repository:

| Image                                                  | Source           | Role                                                                    |
| ------------------------------------------------------ | ---------------- | ----------------------------------------------------------------------- |
| `ghcr.io/deutschemodelunitednations/shoebox`           | `apps/server`    | Web app and API. Runs database migrations on start.                     |
| `ghcr.io/deutschemodelunitednations/shoebox-processor` | `apps/processor` | Worker that renders thumbnails, previews, poster frames and blurhashes. |

Both are also pushed to Docker Hub under `deutschemodelunitednations/`.

### Repository layout

```
apps/
  server/      SvelteKit app: routes, GraphQL handlers, OIDC, storage helpers, i18n
  processor/   Bun worker: claims jobs from Postgres, processes media, writes to S3
packages/
  db/          Drizzle schema, relations, migrations and the job queue helpers
  shared/      Code both apps need: ids, env schemas, S3 client, job contracts
scripts/dev/   Local development helpers (Garage bootstrap)
garage/        Garage config for dev.docker-compose.yml
```

### Access model

| Who         | How it is determined                                                         | Sees                          | May                                                    |
| ----------- | ---------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------ |
| Visitor     | not logged in                                                                | public media                  | browse                                                 |
| Signed in   | any OIDC login                                                               | public media                  | browse                                                 |
| Fotograf*in | email granted by an admin under Admin › Nutzer*innen, stored in the database | like team                     | upload to and manage the conferences assigned to them  |
| Team        | email in `TEAM_EMAIL_WHITELIST` or domain in `TEAM_DOMAIN_WHITELIST`         | public and team-private media | the above                                              |
| Admin       | `ADMIN_EMAIL_WHITELIST` / `ADMIN_DOMAIN_WHITELIST`, always team              | everything                    | manage everything, grant per-conference editing rights |

Team and admin are derived from the email at request time. The Fotograf*in role is the only one stored, it applies from the first login with that email. There is no OIDC role claim parsing. Hidden conferences are visible to admins and their assigned photographers only.

### Media pipeline

1. The browser asks the server for a presigned `PUT` and uploads the original straight into the private originals bucket.
2. The server records the media and enqueues a processing job (`packages/db` → `enqueueJob`), which also fires a Postgres `NOTIFY`.
3. A processor claims the job with `FOR UPDATE SKIP LOCKED`, renders WebP derivatives (`thumb`, `medium`, `large`), a blurhash and EXIF (GPS kept separate) with sharp, or a poster frame with ffmpeg for video, and uploads them to the public derivatives bucket. `medium` and `large` carry a subtle white DMUN watermark there, their watermark-free copies go to the private originals bucket (`media/<id>/clean/`) for team downloads.
4. Uploads also hash every file with SHA-256 in the browser. Exact copies of a photo in the same conference are held back until someone decides in the duplicate review, near copies (perceptual hash) are flagged there too.
5. ZIP archives go to S3 as a multipart upload. A `ZIP_IMPORT` job unpacks them, maps folders to categories as chosen in the browser and queues every image.
6. Watermark position, size, opacity, photographer credit, download sizes and who may download what are admin settings. Changing them re-renders every photo.
7. Deleted photos stay in a per-conference trash for 30 days, the processor purges them afterwards.
8. Failed jobs retry with exponential backoff up to `maxAttempts`, jobs left `RUNNING` by a crashed worker are recovered automatically.

## Development

Requirements: Docker, [Bun](https://bun.sh), Node.js.

```bash
bun i
cp .env.example .env     # the defaults match the dev containers
bun run dev
```

`bun run dev` runs four processes side by side:

| Prefix      | What                                                                                    |
| ----------- | --------------------------------------------------------------------------------------- |
| `server`    | `vite dev` at <https://localhost:5173> (mkcert certificate) with the mock OIDC provider |
| `processor` | the worker in watch mode, health at <http://127.0.0.1:3001/healthz>                     |
| `docker`    | Postgres on `localhost:5434` and Garage (S3 `:3900`, web `:3902`, admin `:3903`)        |
| `s3`        | one-shot bootstrap of buckets, website access and CORS, then exits                      |

Run `bun run db:migrate` once after the containers are up (or `bun run db:nuke` for a clean slate), then `bun run db:seed` for the demo gallery. The seed needs the demo photos in `scripts/dev/demo-photos/`, which are not in the repository. Log in at <https://localhost:5173/login>, the mock provider offers one button per user in `apps/server/oidc-mock.yaml`.

Derivatives are served from Garage's web endpoint at `http://shoebox-derivatives.web.localhost:3902/<key>`. Browsers resolve `*.localhost` to the loopback address, command line tools may not.

### Commands

| Command                     | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `bun run dev`               | Everything above                                          |
| `bun run dev:server`        | Dev server only                                           |
| `bun run dev:processor`     | Processor only                                            |
| `bun run dev:docker`        | Containers only                                           |
| `bun run check`             | `svelte-check` for the server                             |
| `bun run typecheck`         | `tsc` for the packages and the processor                  |
| `bun run lint`              | ESLint                                                    |
| `bun run format`            | Prettier                                                  |
| `bun run test`              | Vitest, packages and both apps                            |
| `bun run fallow`            | Dead code, duplication and complexity report              |
| `bun run i18n:check`        | Compare message keys across locales                       |
| `bun run machine-translate` | Fill missing translations                                 |
| `bun run db:generate`       | Generate a migration from schema changes                  |
| `bun run db:migrate`        | Apply migrations                                          |
| `bun run db:studio`         | Drizzle Studio                                            |
| `bun run db:nuke`           | Drop the dev volumes, recreate the containers and migrate |
| `bun run db:seed`           | Demo gallery: rows, originals in S3, processing jobs      |
| `bun run build`             | Production build of the server                            |

### GraphQL client

Rumble generates a typed urql client into `apps/server/src/lib/api/rumbleClient/` whenever the dev server (or a build) registers the handlers. Do not edit those files, they are regenerated on the next request to `/api/graphql`.

## Configuration

Every variable is documented in [`.env.example`](./.env.example). The server validates them with Zod in `apps/server/src/lib/config/`, the processor in `apps/processor/src/config.ts`. Both processes need `DATABASE_URL` and the `S3_*` variables, the server additionally needs the `PUBLIC_OIDC_*` variables, the whitelists and `PUBLIC_MEDIA_BASE_URL`.

Shoebox has no built-in authentication. Bring any OpenID Connect provider, [pocket-id](https://github.com/pocket-id/pocket-id), [Zitadel](https://zitadel.com/) or [Logto](https://logto.io/) all work.

## Deployment

```bash
docker build -f apps/server/Dockerfile -t shoebox .
docker build -f apps/processor/Dockerfile -t shoebox-processor .
```

Run one server container (it applies migrations on start and listens on `3000`) and as many processor containers as you need (health on `3001`). Both need the same `DATABASE_URL` and `S3_*` settings. Point `PUBLIC_MEDIA_BASE_URL` at a CDN or the public endpoint of the derivatives bucket.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[AGPL-3.0](./LICENSE)
