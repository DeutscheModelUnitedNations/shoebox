import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

export const relations = defineRelations(schema, (r) => ({
	series: {
		events: r.many.event()
	},
	event: {
		series: r.one.series({ from: r.event.seriesId, to: r.series.id, optional: false }),
		categories: r.many.category(),
		media: r.many.media({ from: r.event.id, to: r.media.eventId })
	},
	category: {
		event: r.one.event({ from: r.category.eventId, to: r.event.id, optional: false }),
		media: r.many.media({ from: r.category.id, to: r.media.categoryId })
	},
	media: {
		event: r.one.event({ from: r.media.eventId, to: r.event.id, optional: false }),
		category: r.one.category({ from: r.media.categoryId, to: r.category.id })
	}
}));
