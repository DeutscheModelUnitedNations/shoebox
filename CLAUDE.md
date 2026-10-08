# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Shoebox is DMUN's photo and video gallery for Model United Nations conferences. Public visitors browse public media, team members also see team-private media, admins manage everything and can grant per-conference editing rights (for photographers).

**Tech stack**: Bun workspaces monorepo. SvelteKit + Svelte 5 (runes) + TypeScript, PostgreSQL + Drizzle ORM, GraphQL via [Rumble](https://github.com/m1212e/rumble) (Pothos + Yoga, ability based access control), plain urql client, Tailwind CSS v4 + DaisyUI + DMUN corporate identity, Phosphor icons (duotone), Paraglide i18n (en base, de). S3-compatible object storage (Garage in dev). A separate Bun worker (sharp, ffmpeg, blurhash) processes media.

The repository is modelled on [MUNify CHASE](https://github.com/DeutscheModelUnitedNations/munify-chase); when in doubt about a pattern, that is the reference.

## Layout

```
apps/server      SvelteKit app (Node adapter in production)
apps/processor   Bun worker, own Docker image
packages/db      Drizzle schema, relations, migrations, job queue helpers (@shoebox/db)
packages/shared  nanoid, Zod env schemas, S3 client factory, job contracts (@shoebox/shared)
scripts/dev      Garage bootstrap (buckets, global alias, website access, CORS)
```

Workspace packages export TypeScript sources directly. Vite bundles them into the server build (`ssr.noExternal`), Bun runs them as is in the processor. There is one hoisted `node_modules` at the root (`bunfig.toml`).

## Common commands

```bash
bun run dev              # dev server + processor + docker (postgres, garage) + s3 bootstrap
bun run dev:server       # vite dev only (https://localhost:5173, mock OIDC inside)
bun run dev:processor    # worker only, watch mode
bun run dev:docker       # containers only

bun run check            # svelte-check (apps/server)
bun run typecheck        # tsc for packages/* and apps/processor
bun run lint             # eslint, whole repo
bun run format           # prettier, whole repo
bun run test             # vitest: packages + processor from the root, then apps/server
bun run fallow:audit     # findings introduced vs. the base branch
bun run i18n:check       # message keys across locales
bun run machine-translate

bun run db:generate      # drizzle-kit generate (packages/db/drizzle/<timestamp>_<name>/)
bun run db:migrate
bun run db:studio
bun run db:nuke          # drop dev volumes, recreate, migrate
bun run db:seed          # demo gallery: rows, originals in S3, processing jobs
bun run build            # production build of the server
```

Root scripts `cd` into the workspace, `bun --env-file=../../.env` injects the shared `.env` where Vite does not do it (processor, drizzle-kit). The server reads the root `.env` through `kit.env.dir` in `svelte.config.js`.

## Architecture

### Server (`apps/server/src`)

- `api/rumble.ts` creates the Rumble instance (`db`, `schema`, `context`). `api/handlers/register.ts` imports every handler and, in dev or during the build, regenerates the typed client into `lib/api/rumbleClient/`.
- `api/handlers/*.ts` define abilities, object types, queries and mutations per table with the Rumble DSL (`abilityBuilder`, `object`, `query`, `schemaBuilder`, `pubsub`). Custom resolvers must apply `ctx.abilities.<table>.filter(action)` themselves.
- `api/context.ts` builds the request context: `user` (OIDC claims), `isTeam`, `isAdmin`, `isPhotographer`, `mustBeLoggedIn()`, `mustManage(eventId)`, `mustUpload()`. Whitelist checks live in `api/services/authHelper.ts`, the resolved `Roles` (admin, team, photographer and the assigned event ids) in `api/services/roles.ts`. `hooks.server.ts` puts them on `locals.roles` for load functions.
- `api/handlers/{upload,manage,admin}.ts` hold the studio mutations. Their logic lives in `api/services/manage.ts` (uploads, multipart ZIP uploads, bulk edits, trash, duplicate decisions), `api/services/catalog.ts` (series, events, categories, photographers, settings) and the pure, tested `api/services/mediaRows.ts`.
- `api/services/OIDC.ts` wraps `@m1212e/sveltekit-oidc`. `authenticatedRoutes` (`/login`, `/upload`, `/manage`, `/admin`) trigger the login flow, every other route is public. Users are upserted on login.
- `api/services/storage.ts`: S3 client, presigned upload/download URLs, public derivative URLs. `api/services/health.ts`: database, buckets and queue status for `/api/health`.
- `lib/config/{public,private}.ts`: Zod-validated env wrappers. Read config through them, never from `$env` or `process.env` directly.
- `lib/api/client.ts` exports `urqlClient` for the generated client. No normalized cache, no offline persistence (deliberate, unlike chase).
- `routes/`: the gallery from the "Galerie v2" design. `/` landing, `/usage` usage notes, `/[series]` all editions of a conference series, `/[series]/[event]` conference page, `/[series]/[event]/[...category]` photo grid with the category sidebar. The lightbox is an overlay driven by `?photo=<id>`, so every photo has a shareable URL. The `(studio)` group holds the work screens of the "Hochladen, Verwalten und Admin" design: `/upload` (single files and ZIP), `/manage/[eventId]` with `duplicates` and `trash` for photographers and admins, `/admin/{events,users,settings,usage}` for admins. `/login` and `/logout` are server-only redirects, `/api/graphql` is Yoga, `/api/health` is JSON.
- `lib/server/gallery/`: the read side the load functions call (`listSeries`, `getSeries`, `getEvent`, `getCategoryPage`). `load.ts` queries Postgres for READY media the viewer may see (`viewerOf(locals)`, guests never receive team-private rows) and turns derivatives into URLs: public ones from `PUBLIC_MEDIA_BASE_URL`, private ones presigned. `tree.ts` builds the view models (`lib/gallery/types.ts`) and is unit tested.
- `routes/api/media/[id]/download`: redirects to a presigned GET with `Content-Disposition: attachment`. Guests get the watermarked `medium`/`large`, team members also `original` and `clean=1` (watermark-free copies).
- `lib/server/studio/`: reads of the studio load functions (`load.ts`, `pages.ts`). `lib/studio/`: client state and pure helpers (upload queue, ZIP folder mapping, edit form, dialog drafts, category editor), `lib/components/studio/`: the studio components.
- `lib/components/`: `SiteHeader`, `SiteFooter`, `Logo` (DMUN CDN artwork, light and dark), `AccentStripe`, `LeafWatermark`, `EventCard`, `CategoryGrid`, `PhotoMasonry`, `Lightbox`, `DownloadPanel`, `CopyLinkButton`.

### Processor (`apps/processor/src`)

- `index.ts` wires config, db, S3, the `LISTEN` connection, a health server (`/healthz`) and graceful shutdown.
- `worker.ts` claims jobs up to `PROCESSOR_CONCURRENCY`, sleeps until a `NOTIFY` or the poll interval, recovers stale `RUNNING` jobs.
- `handlers/`: one handler per job type (`PING`, `IMAGE_DERIVATIVES`, `VIDEO_DERIVATIVES`, `ZIP_IMPORT`). Image renders read the watermark and download sizes from the `setting` table. `detectDuplicates` (set by uploads and ZIP imports only) records perceptual-hash matches as `duplicate_candidate`. Payloads are validated with the Zod schemas from `@shoebox/shared`. Results land in `processing_job.result` and, for media, on the `media` row (`markMediaReady`). Payloads with `public: false` (team-private media) keep every derivative in the private bucket. Media whose job exhausts its retries is marked FAILED.
- `trash.ts` purges media deleted more than 30 days ago, hourly.

### Database (`packages/db`)

- `src/schema.ts` is the source of truth: `user`, `processing_job`, and the gallery domain `series` › `event` › `category` (self-referencing tree) › `media`. Media carries `visibility` (PUBLIC/TEAM), `status` (PENDING/READY/FAILED), `highlight` and the processor's `derivatives`. `photographer` and `event_photographer` model the Fotograf*in role and its events, `duplicate_candidate` open duplicate pairs, `setting` the admin settings (jsonb, Zod schemas in `@shoebox/shared`). Media also has `sha256`, `phash`, `uploadBatch` and `deletedAt` (trash).
- `src/media.ts`: `markMediaReady`/`markMediaFailed`, called by the processor, plus `nextMediaSortOrder` and `mediaByHash`. `src/settings.ts`: `getSetting`/`putSetting`. `src/duplicates.ts`: Hamming similarity and `recordSimilarPhotos`.
- `src/queue.ts`: `enqueueJob`, `claimJob` (`FOR UPDATE SKIP LOCKED`), `completeJob`, `failJob` (exponential backoff), `recoverStaleJobs`, `queueStats`. `src/listen.ts` holds the dedicated `LISTEN` connection.
- Migrations are generated into `drizzle/` and applied on server start (Dockerfile `CMD`).

## Conventions

- **IDs**: nanoid, 30 chars, no lookalikes (`@shoebox/shared`). OIDC `sub` is the user id.
- **Database columns**: snake_case via `snakeCase.table`. Timestamps `created_at`, `updated_at` on every table.
- **i18n**: `apps/server/messages/{en,de}.json`, used as `m.key()` from `$lib/paraglide/messages`. Add English first.
- **Icons**: `phosphor-svelte`, import per icon from `phosphor-svelte/lib/<Name>Icon`, weight `duotone` by default.
- **Styling**: Tailwind v4 + DaisyUI (themes off, DMUN themes from the corporate identity package), `data-theme` light/dark. Use DaisyUI components (`btn`, `badge`, `menu`, `breadcrumbs`, `modal`, `join`, `radio`, …) and theme colours (`primary` headings and links, `neutral` for dark surfaces, `base-200` for text boxes, `accent` only for the Akzentstreifen), Tailwind utilities for everything else. No custom CSS tokens. Flat by rule: no shadows on cards, no rounding except the Akzentstreifen and DaisyUI's own controls.
- **Demo data**: `bun run db:seed` (`--force` to replace) creates the design's series, events and categories, grants `photo@example.com` the latest MUN-SH, uploads the photos from `scripts/dev/demo-photos/` as originals and queues them for the processor. That folder is gitignored because the photos show identifiable people.
- **Storage keys**: decided in `storageKeys` (`@shoebox/shared`), nowhere else.
- **Jobs**: new job types are added to `processingJobTypes` + `jobPayloadSchemas` in `@shoebox/shared`, then to `handlers/index.ts` in the processor, then a migration for the enum.
- Prose in docs: no semicolons or em dashes.

## Design decisions (settled, do not reopen without the maintainers)

- Uploads go browser → S3 via presigned `PUT`, the server never streams originals.
- Derivatives live in a public bucket behind `PUBLIC_MEDIA_BASE_URL`, originals and team-private items are served via short-lived presigned `GET`s.
- Every download is watermarked by default (`apps/processor/src/watermark.ts`, the long white DMUN logo with the full name, bottom-right by default): public `medium`/`large` derivatives, and a private full-resolution `storageKeys.watermarkedOriginal` for team members. Watermark-free files (`storageKeys.cleanDerivative`, the original upload) live only in the private bucket and are served to team members who tick "without watermark" (`clean=1`).
- Team and admin status come from email/domain whitelists only, no OIDC role claims. The only role stored in the database is Fotograf*in, granted by admins by email (pending until the first login), with team rights everywhere plus upload and manage rights on assigned events.
- Studio writes go through Rumble GraphQL mutations, studio reads through load functions. Exact duplicates are detected by SHA-256 in the browser, near duplicates by perceptual hash in the processor, both within one event. Deletes go to a 30-day trash. ZIP archives up to 20 GB go to S3 as multipart uploads and are unpacked by the processor.
- The queue is our own table, not pg-boss. The processor is a separate image on the Bun runtime.
- No urql graphcache/offline mode. Server load functions query the database directly.
- Out of scope for now: SFTP ingest, filesystem storage backend, Dokploy deploy hook, PR lint workflow.

## Generated files (do not edit)

- `apps/server/src/lib/api/rumbleClient/` (committed, regenerated by the dev server)
- `apps/server/src/lib/paraglide/` (gitignored, compiled by the Vite plugin or `bun run i18n:compile`)
- `packages/db/drizzle/` (migrations, generated by `bun run db:generate`)

## Authentication in development

oidc-mock runs inside `vite dev` (`oidcMock()` plugin). Users and claims are in `apps/server/oidc-mock.yaml`, edits apply live. `admin@dmun.de` is admin via `ADMIN_EMAIL_WHITELIST`, `*@dmun.de` is team via `TEAM_DOMAIN_WHITELIST`, the other users are plain accounts.

## Codebase intelligence (fallow)

`.fallowrc.jsonc` ignores generated output. The pre-commit hook runs `fallow audit --base HEAD` and fails only on findings the commit introduces. CI posts an advisory report on pull requests and never blocks.

## Svelte MCP

The Svelte MCP server (list-sections, get-documentation, svelte-autofixer) is available for Svelte 5 and SvelteKit questions. Use list-sections first, fetch the relevant docs, and run svelte-autofixer on Svelte code before finishing.
