import { json } from '@sveltejs/kit';
import { getHealth } from '$api/services/health';

export async function GET() {
	const health = await getHealth();
	return json(health, { status: health.ok ? 200 : 503 });
}
