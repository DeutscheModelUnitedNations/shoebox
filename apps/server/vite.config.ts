import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';
import { oidcMock } from 'oidc-mock/vite';
import { defineConfig, type Connect, type Plugin } from 'vite';
import mkcert from 'vite-plugin-mkcert';

// Vite needs to serve files from the workspace packages. `.env` loading is configured in
// svelte.config.js (kit.env.dir), SvelteKit ignores Vite's envDir for `$env` modules.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
// mkcert and the OIDC mock only make sense for a running dev server, not for vitest.
const isTest = !!process.env.VITEST;

/**
 * oidc-mock 0.2.0 parses every request with `new URL(req.url, base)`. A path starting with
 * `//` reads as a protocol-relative URL with an empty host, throws, and the unhandled
 * rejection kills the dev server. Collapse leading slashes before it sees the request.
 */
function collapseLeadingSlashes(): Plugin {
	const middleware: Connect.NextHandleFunction = (req, _res, next) => {
		if (req.url?.startsWith('//')) req.url = req.url.replace(/^\/{2,}/, '/');
		next();
	};
	return {
		name: 'collapse-leading-slashes',
		configureServer: (server) => void server.middlewares.use(middleware),
		configurePreviewServer: (server) => void server.middlewares.use(middleware)
	};
}

export default defineConfig({
	plugins: [
		// Serve the dev server over HTTPS with a locally trusted certificate
		...(isTest ? [] : [mkcert()]),
		// Local OIDC provider for development, users are configured in oidc-mock.yaml
		...(isTest ? [] : [collapseLeadingSlashes(), oidcMock()]),
		tailwindcss(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['cookie', 'preferredLanguage', 'baseLocale']
		}),
		sveltekit()
	],
	ssr: {
		// Workspace packages ship TypeScript sources, bundle them into the server build.
		noExternal: ['@shoebox/db', '@shoebox/shared']
	},
	server: {
		fs: {
			allow: [repoRoot]
		},
		watch: {
			ignored: ['**/.claude/**', '**/node_modules/**', '**/.svelte-kit/**']
		}
	}
});
