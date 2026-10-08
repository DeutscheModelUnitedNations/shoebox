import { db } from '$api/db';
import { abilityBuilder, object, query, schemaBuilder } from '$api/rumble';

// Admins read every user, everyone else only their own row.
abilityBuilder.user.allow('read').when((ctx) => {
	if (ctx.isAdmin) return 'allow';
	return { where: { id: ctx.mustBeLoggedIn().sub } };
});

export const UserRef = object({ table: 'user' });

query({ table: 'user' });

schemaBuilder.queryFields((t) => ({
	me: t.drizzleField({
		type: UserRef,
		nullable: true,
		description: 'The signed-in user, or null for anonymous visitors.',
		resolve: (query, _root, _args, ctx) => {
			if (!ctx.user) return null;
			return db.query.user.findFirst(query({ where: { id: ctx.user.sub } }));
		}
	})
}));
