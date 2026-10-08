import { client, type Mutation } from './rumbleClient/client';

type Args<K extends keyof Mutation> = Mutation[K] extends (p: infer P) => unknown ? P : never;
type Result<K extends keyof Mutation> = Mutation[K] extends (p: never) => infer R ? R : never;

/**
 * Calls a mutation of the generated rumble client. The generator types mutations that return
 * a scalar as plain values, at runtime every mutation takes `{ __args, ...selection }` and
 * resolves to its result, which this wrapper encodes once.
 */
export function mutate<K extends keyof Mutation>(
	name: K,
	args: Args<K>,
	selection: Record<string, true> = {}
): Promise<Result<K>> {
	const call = (client.mutate as unknown as Record<string, (input: unknown) => Promise<Result<K>>>)[
		name
	];
	return call({ __args: args, ...selection });
}
