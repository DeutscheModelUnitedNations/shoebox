import { GraphQLError } from 'graphql';
import { schemaBuilder } from '$api/rumble';
import {
	deleteForever,
	eventsOf,
	reorderMedia,
	resolveDuplicate,
	restoreMedia,
	setEventCover,
	trashMedia,
	updateMedia
} from '$api/services/manage';
import { MediaVisibilityEnum } from './upload';

const DuplicateKeepEnum = schemaBuilder.enumType('DuplicateKeep', {
	values: ['LEFT', 'RIGHT', 'BOTH'] as const
});

const DuplicateDecisionInput = schemaBuilder.inputType('DuplicateDecisionInput', {
	fields: (t) => ({
		candidateId: t.id({ required: true }),
		keep: t.field({ type: DuplicateKeepEnum, required: true })
	})
});

/** Every id must belong to `eventId`, which the person must manage. */
async function mustManageMedia(
	ctx: { mustManage: (eventId: string) => unknown },
	eventId: string,
	ids: string[]
) {
	ctx.mustManage(eventId);
	const events = await eventsOf(ids);
	if ([...events.values()].some((e) => e !== eventId) || events.size !== new Set(ids).size) {
		throw new GraphQLError('Photo is not in this event');
	}
}

schemaBuilder.mutationFields((t) => ({
	updateMedia: t.field({
		type: 'Int',
		description:
			'Bulk edit of photos in one event. Null fields stay unchanged. With `moveCategory` the photos move to `categoryId`, null meaning no category.',
		args: {
			eventId: t.arg.id({ required: true }),
			mediaIds: t.arg.idList({ required: true }),
			title: t.arg.string(),
			moveCategory: t.arg.boolean(),
			categoryId: t.arg.id(),
			visibility: t.arg({ type: MediaVisibilityEnum }),
			photographer: t.arg.string()
		},
		resolve: async (_root, args, ctx) => {
			const eventId = String(args.eventId);
			const ids = args.mediaIds.map(String);
			await mustManageMedia(ctx, eventId, ids);
			return updateMedia(eventId, ids, {
				title: args.title,
				moveCategory: args.moveCategory ?? false,
				categoryId: args.categoryId ? String(args.categoryId) : null,
				visibility: args.visibility,
				photographer: args.photographer
			});
		}
	}),

	reorderMedia: t.field({
		type: 'Int',
		description: 'Saves the order of one category view, the gallery follows immediately.',
		args: {
			eventId: t.arg.id({ required: true }),
			orderedIds: t.arg.idList({ required: true })
		},
		resolve: async (_root, args, ctx) => {
			const eventId = String(args.eventId);
			const ids = args.orderedIds.map(String);
			await mustManageMedia(ctx, eventId, ids);
			return reorderMedia(eventId, ids);
		}
	}),

	setEventCover: t.field({
		type: 'Boolean',
		args: { eventId: t.arg.id({ required: true }), mediaId: t.arg.id({ required: true }) },
		resolve: async (_root, args, ctx) => {
			ctx.mustManage(String(args.eventId));
			await setEventCover(String(args.eventId), String(args.mediaId));
			return true;
		}
	}),

	trashMedia: t.field({
		type: 'Int',
		description: 'Moves photos to the trash of their event, they are purged after 30 days.',
		args: { eventId: t.arg.id({ required: true }), mediaIds: t.arg.idList({ required: true }) },
		resolve: async (_root, args, ctx) => {
			const eventId = String(args.eventId);
			const ids = args.mediaIds.map(String);
			await mustManageMedia(ctx, eventId, ids);
			return trashMedia(eventId, ids);
		}
	}),

	restoreMedia: t.field({
		type: 'Int',
		args: { eventId: t.arg.id({ required: true }), mediaIds: t.arg.idList({ required: true }) },
		resolve: async (_root, args, ctx) => {
			const eventId = String(args.eventId);
			const ids = args.mediaIds.map(String);
			await mustManageMedia(ctx, eventId, ids);
			return restoreMedia(eventId, ids);
		}
	}),

	deleteMediaForever: t.field({
		type: 'Int',
		description: 'Deletes trashed photos and their files for good.',
		args: { eventId: t.arg.id({ required: true }), mediaIds: t.arg.idList({ required: true }) },
		resolve: async (_root, args, ctx) => {
			const eventId = String(args.eventId);
			const ids = args.mediaIds.map(String);
			await mustManageMedia(ctx, eventId, ids);
			return deleteForever(eventId, ids);
		}
	}),

	resolveDuplicates: t.field({
		type: 'Int',
		description: 'Applies the decisions of the duplicate review, one per pair.',
		args: {
			eventId: t.arg.id({ required: true }),
			decisions: t.arg({ type: [DuplicateDecisionInput], required: true })
		},
		resolve: async (_root, args, ctx) => {
			const eventId = String(args.eventId);
			ctx.mustManage(eventId);
			let resolved = 0;
			for (const decision of args.decisions) {
				if (await resolveDuplicate(eventId, String(decision.candidateId), decision.keep))
					resolved++;
			}
			return resolved;
		}
	})
}));
