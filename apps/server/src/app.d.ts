// See https://svelte.dev/docs/kit/types#app.d.ts
// `App.Locals.oidc` is declared by @m1212e/sveltekit-oidc.
import type { Roles } from '$api/services/roles';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Resolved once per request in hooks.server.ts */
			roles: Roles;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
