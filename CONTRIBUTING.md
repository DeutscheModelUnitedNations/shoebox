# Contributing to Shoebox

Contributions of all kinds are welcome: bug reports, feature suggestions, code, documentation and testing. Please be aware that your contribution will be published under the [project's license](./LICENSE).

## Getting started

Make sure you have [Docker](https://www.docker.com/get-started/), [Bun](https://bun.sh/) and [Node.js](https://nodejs.org/en/download/current) installed.

```bash
git clone https://github.com/DeutscheModelUnitedNations/shoebox
cd shoebox
bun i
cp .env.example .env
bun run dev
```

`bun run dev` starts the SvelteKit dev server (with the mock OIDC provider), the processor, Postgres and Garage, and bootstraps the S3 buckets. The app is at `https://localhost:5173`. The mock login page lets you sign in with one click as any user from `apps/server/oidc-mock.yaml`.

See the [README](./README.md) for the full command list and architecture notes.

## Working with issues

Before starting implementation, explain your suggested approach in the issue discussion. Issues marked **good first issue** are a good entry point.

## Branches and pull requests

Create a branch from the relevant issue and open a pull request against `main`.

Branch naming:

- `feature/short-description`
- `fix/short-description`
- `docs/short-description`

PR titles follow the conventional commit format `type: description` or `type (scope): description` with one of `feat`, `fix`, `style`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `deps`.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/). The pre-commit hook formats staged files and runs a fallow audit, the pre-push hook lints and checks translations. Bypass a hook with `--no-verify` only when you know why it fails.

## Code style

- Prettier and ESLint are configured at the repository root, `bun run format` and `bun run lint`.
- Messages live in `apps/server/messages/{en,de}.json`. Add the English source first, then `bun run machine-translate` or translate by hand.
- Read environment variables through the Zod wrappers in `apps/server/src/lib/config/` or `apps/processor/src/config.ts`, never from `process.env` directly.
