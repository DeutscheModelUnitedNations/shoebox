import { eq } from 'drizzle-orm';
import { parseSetting, type SettingKey, type SettingValue } from '@shoebox/shared';
import type { Database } from './index';
import { setting } from './schema';

/** Reads one settings document, defaults fill whatever is missing. */
export async function getSetting<K extends SettingKey>(
	db: Database,
	key: K
): Promise<SettingValue<K>> {
	const [row] = await db.select().from(setting).where(eq(setting.key, key));
	return parseSetting(key, row?.value);
}

export async function putSetting<K extends SettingKey>(
	db: Database,
	key: K,
	value: SettingValue<K>,
	updatedById: string | null
) {
	await db
		.insert(setting)
		.values({ key, value, updatedById })
		.onConflictDoUpdate({ target: setting.key, set: { value, updatedById } });
}
