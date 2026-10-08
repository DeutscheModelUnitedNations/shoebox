import { nativeDateExchange } from '@m1212e/rumble/client';
import { Client, fetchExchange } from '@urql/core';

/**
 * Browser-side urql client used by the generated rumble client (src/lib/api/rumbleClient).
 * Deliberately plain: no normalized cache, no offline persistence. Server load functions
 * query the database directly instead of going through GraphQL.
 */
export const urqlClient = new Client({
	url: '/api/graphql',
	exchanges: [nativeDateExchange, fetchExchange],
	fetchOptions: { credentials: 'same-origin' }
});
