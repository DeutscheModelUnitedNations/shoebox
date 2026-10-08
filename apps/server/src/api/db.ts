import { createDb, createMockDb, schema } from '@shoebox/db';
import { building } from '$app/environment';
import { configPrivate } from '$config/private';

export const db = building ? createMockDb() : createDb(configPrivate.DATABASE_URL);
export { schema };
