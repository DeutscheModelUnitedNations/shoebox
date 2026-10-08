import { defineConfig } from 'vitest/config';

// The SvelteKit app (apps/server) runs vitest through its own vite config, see `bun run test`.
export default defineConfig({
	test: {
		projects: ['packages/*', 'apps/processor'],
		passWithNoTests: true
	}
});
