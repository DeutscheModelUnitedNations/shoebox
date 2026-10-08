import { rumble } from '@m1212e/rumble';
import { dev } from '$app/environment';
import { db, schema } from './db';
import { context } from './context';

// Tell the dev server to reload the handlers so the schema builder does not accumulate
// stale fields across hot reloads.
const reloadHandlers = () => import('$api/handlers/register');
if (dev) void reloadHandlers();

export const {
	abilityBuilder,
	schemaBuilder,
	whereArg,
	object,
	query,
	pubsub,
	createYoga,
	enum_,
	clientCreator
} = rumble({
	db,
	schema,
	context,
	defaultLimit: 100
});
