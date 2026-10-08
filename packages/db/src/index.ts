import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { relations } from './relations';

const options = { relations, jit: true } as const;

export type Database = ReturnType<typeof createDb>;

/** Creates a drizzle instance with the project's schema and relations wired up. */
export function createDb(databaseUrl: string) {
	return drizzle(databaseUrl, options);
}

/** A drizzle instance that never touches the network, for build-time imports. */
export function createMockDb(): Database {
	return drizzle.mock(options) as unknown as Database;
}

export { schema, relations };
export * from './queue';
export * from './media';
