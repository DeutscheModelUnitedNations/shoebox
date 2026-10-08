import { getLocale } from '$lib/paraglide/runtime';
import type { DateRange } from './types';

/** "12.–16. März 2026", "März 2025" or "2025", depending on the precision. */
export function formatDateRange(range: DateRange, locale = getLocale()) {
	const from = new Date(range.from);
	if (range.precision === 'year') return String(from.getUTCFullYear());
	if (range.precision === 'month') {
		return new Intl.DateTimeFormat(locale, {
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		}).format(from);
	}
	const format = new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
	return range.to ? format.formatRange(from, new Date(range.to)) : format.format(from);
}

export function formatDate(iso: string, locale = getLocale()) {
	return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
		new Date(iso)
	);
}

export function formatBytes(bytes: number, locale = getLocale()) {
	const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
	let value = bytes;
	let unit = 0;
	while (value >= 1000 && unit < units.length - 1) {
		value /= 1000;
		unit++;
	}
	return new Intl.NumberFormat(locale, {
		style: 'unit',
		unit: units[unit],
		unitDisplay: 'short',
		maximumFractionDigits: unit >= 2 ? 1 : 0
	}).format(value);
}

export function formatNumber(value: number, locale = getLocale()) {
	return new Intl.NumberFormat(locale).format(value);
}
