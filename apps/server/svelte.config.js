import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		env: {
			// The whole monorepo shares one .env at the repository root.
			dir: '../..'
		},
		adapter: adapter({
			precompress: true
		}),
		alias: {
			$api: 'src/api',
			$config: 'src/lib/config'
		}
	}
};

export default config;
