import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

// No relations yet. Domain tables (conference, album, media) arrive with the design.
export const relations = defineRelations(schema, () => ({}));
