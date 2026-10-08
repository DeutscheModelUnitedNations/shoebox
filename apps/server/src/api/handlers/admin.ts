import {
	downloadSettingsSchema,
	usageSettingsSchema,
	watermarkPolicies,
	watermarkSettingsSchema
} from '@shoebox/shared';
import { enum_, schemaBuilder } from '$api/rumble';
import { requireAdmin } from '$api/services/authHelper';
import {
	assignPhotographer,
	copyCategories,
	createCategory,
	createEvent,
	createSeries,
	deleteCategory,
	deleteEvent,
	deleteSeries,
	invitePhotographer,
	renameCategory,
	reorderCategories,
	revokePhotographer,
	saveRenderSettings,
	saveUsageNotes,
	setCategoryHidden,
	unassignPhotographer,
	updateEvent,
	updateSeries
} from '$api/services/catalog';

const SeriesKindEnum = enum_({ tsName: 'seriesKind' });
const EventVisibilityEnum = enum_({ tsName: 'eventVisibility' });
const DatePrecisionEnum = enum_({ tsName: 'datePrecision' });
const WatermarkPolicyEnum = schemaBuilder.enumType('WatermarkPolicy', {
	values: watermarkPolicies
});

const SeriesInput = schemaBuilder.inputType('SeriesInput', {
	fields: (t) => ({
		name: t.string({ required: true }),
		shortName: t.string({ required: true }),
		region: t.string({ required: true }),
		kind: t.field({ type: SeriesKindEnum, required: true })
	})
});

const EventInput = schemaBuilder.inputType('EventInput', {
	fields: (t) => ({
		seriesId: t.id({ required: true }),
		name: t.string({ required: true }),
		edition: t.string({ required: true }),
		subtitle: t.string({ required: true }),
		location: t.string({ required: true }),
		description: t.string({ required: true }),
		/** ISO date, YYYY-MM-DD */
		dateFrom: t.string({ required: true }),
		dateTo: t.string(),
		datePrecision: t.field({ type: DatePrecisionEnum, required: true }),
		visibility: t.field({ type: EventVisibilityEnum, required: true }),
		rights: t.string()
	})
});

const DownloadSizeInput = schemaBuilder.inputType('DownloadSizeInput', {
	fields: (t) => ({
		longEdge: t.int(),
		guests: t.boolean({ required: true }),
		team: t.boolean({ required: true }),
		watermark: t.field({ type: WatermarkPolicyEnum, required: true })
	})
});

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function eventInput(input: typeof EventInput.$inferInput) {
	const dates = [input.dateFrom, input.dateTo].filter(Boolean) as string[];
	if (!dates.every((d) => isoDate.test(d))) throw new Error('Dates must be YYYY-MM-DD');
	return {
		...input,
		seriesId: String(input.seriesId),
		dateTo: input.dateTo || null,
		rights: input.rights ?? null
	};
}

schemaBuilder.mutationFields((t) => ({
	createSeries: t.field({
		type: 'ID',
		args: { input: t.arg({ type: SeriesInput, required: true }) },
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			return (await createSeries(args.input)).id;
		}
	}),
	updateSeries: t.field({
		type: 'Boolean',
		args: { id: t.arg.id({ required: true }), input: t.arg({ type: SeriesInput, required: true }) },
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			await updateSeries(String(args.id), args.input);
			return true;
		}
	}),
	deleteSeries: t.field({
		type: 'Boolean',
		args: { id: t.arg.id({ required: true }) },
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			await deleteSeries(String(args.id));
			return true;
		}
	}),

	createEvent: t.field({
		type: 'ID',
		args: { input: t.arg({ type: EventInput, required: true }) },
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			return (await createEvent(eventInput(args.input))).id;
		}
	}),
	updateEvent: t.field({
		type: 'Boolean',
		args: { id: t.arg.id({ required: true }), input: t.arg({ type: EventInput, required: true }) },
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			await updateEvent(String(args.id), eventInput(args.input));
			return true;
		}
	}),
	deleteEvent: t.field({
		type: 'Boolean',
		args: { id: t.arg.id({ required: true }) },
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			await deleteEvent(String(args.id));
			return true;
		}
	}),

	createCategory: t.field({
		type: 'ID',
		args: {
			eventId: t.arg.id({ required: true }),
			parentId: t.arg.id(),
			name: t.arg.string({ required: true })
		},
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			const parent = args.parentId ? String(args.parentId) : null;
			return (await createCategory(String(args.eventId), parent, args.name)).id;
		}
	}),
	renameCategory: t.field({
		type: 'Boolean',
		args: { id: t.arg.id({ required: true }), name: t.arg.string({ required: true }) },
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			await renameCategory(String(args.id), args.name);
			return true;
		}
	}),
	setCategoryHidden: t.field({
		type: 'Boolean',
		args: { id: t.arg.id({ required: true }), hidden: t.arg.boolean({ required: true }) },
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			await setCategoryHidden(String(args.id), args.hidden);
			return true;
		}
	}),
	reorderCategories: t.field({
		type: 'Boolean',
		args: { eventId: t.arg.id({ required: true }), orderedIds: t.arg.idList({ required: true }) },
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			await reorderCategories(String(args.eventId), args.orderedIds.map(String));
			return true;
		}
	}),
	deleteCategory: t.field({
		type: 'Boolean',
		description: 'Deletes a category with its sub categories, their photos move to `moveTo`.',
		args: { id: t.arg.id({ required: true }), moveTo: t.arg.id() },
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			await deleteCategory(String(args.id), args.moveTo ? String(args.moveTo) : null);
			return true;
		}
	}),
	copyCategories: t.field({
		type: 'Int',
		args: {
			fromEventId: t.arg.id({ required: true }),
			toEventId: t.arg.id({ required: true })
		},
		resolve: (_root, args, ctx) => {
			requireAdmin(ctx);
			return copyCategories(String(args.fromEventId), String(args.toEventId));
		}
	}),

	invitePhotographer: t.field({
		type: 'String',
		description:
			'Grants the Fotograf*in role to an email. Applies on the first login with that email.',
		args: { email: t.arg.string({ required: true }) },
		resolve: (_root, args, ctx) => {
			requireAdmin(ctx);
			return invitePhotographer(args.email, ctx.mustBeLoggedIn().sub);
		}
	}),
	revokePhotographer: t.field({
		type: 'Boolean',
		args: { email: t.arg.string({ required: true }) },
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			await revokePhotographer(args.email);
			return true;
		}
	}),
	assignPhotographer: t.field({
		type: 'Boolean',
		args: { eventId: t.arg.id({ required: true }), email: t.arg.string({ required: true }) },
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			await assignPhotographer(String(args.eventId), args.email);
			return true;
		}
	}),
	unassignPhotographer: t.field({
		type: 'Boolean',
		args: { eventId: t.arg.id({ required: true }), email: t.arg.string({ required: true }) },
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			await unassignPhotographer(String(args.eventId), args.email);
			return true;
		}
	}),

	saveRenderSettings: t.field({
		type: 'Int',
		description:
			'Saves watermark and download settings. Returns how many photos were queued for a new render.',
		args: {
			/** One of bottom-right, bottom-left, top-right, top-left, center */
			position: t.arg.string({ required: true }),
			size: t.arg.int({ required: true }),
			opacity: t.arg.int({ required: true }),
			credit: t.arg.boolean({ required: true }),
			preview: t.arg({ type: DownloadSizeInput, required: true }),
			web: t.arg({ type: DownloadSizeInput, required: true }),
			original: t.arg({ type: DownloadSizeInput, required: true })
		},
		resolve: (_root, args, ctx) => {
			requireAdmin(ctx);
			const watermark = watermarkSettingsSchema.parse({
				position: args.position,
				size: args.size,
				opacity: args.opacity,
				credit: args.credit
			});
			const { longEdge: _ignored, ...original } = args.original;
			const downloads = downloadSettingsSchema.parse({
				preview: args.preview,
				web: args.web,
				original
			});
			return saveRenderSettings(watermark, downloads, ctx.mustBeLoggedIn().sub);
		}
	}),
	saveUsageNotes: t.field({
		type: 'Boolean',
		args: { de: t.arg.string({ required: true }), en: t.arg.string({ required: true }) },
		resolve: async (_root, args, ctx) => {
			requireAdmin(ctx);
			await saveUsageNotes(usageSettingsSchema.parse(args), ctx.mustBeLoggedIn().sub);
			return true;
		}
	})
}));
