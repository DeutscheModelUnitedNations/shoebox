/** URL slug from a display name: lowercase ASCII, umlauts transliterated, dashes between words. */
export function slugify(text: string) {
	return (
		text
			.toLowerCase()
			.replace(/ä/g, 'ae')
			.replace(/ö/g, 'oe')
			.replace(/ü/g, 'ue')
			.replace(/ß/g, 'ss')
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'eintrag'
	);
}

/** Appends -2, -3 … until the slug is not taken. */
export function uniqueSlug(base: string, taken: Iterable<string>) {
	const used = new Set(taken);
	if (!used.has(base)) return base;
	for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}
