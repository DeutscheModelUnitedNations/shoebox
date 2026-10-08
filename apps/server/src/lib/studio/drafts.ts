/** Form state of the admin dialogs for conferences and series. */

export interface EventDraft {
	seriesId: string;
	name: string;
	edition: string;
	subtitle: string;
	location: string;
	description: string;
	dateFrom: string;
	dateTo: string;
	datePrecision: 'DAY' | 'MONTH' | 'YEAR';
	visibility: 'PUBLIC' | 'HIDDEN';
	rights: string;
}

export interface SeriesDraft {
	id: string | null;
	name: string;
	shortName: string;
	region: string;
	kind: 'CONFERENCE' | 'ASSOCIATION';
}

type SeriesLike = Omit<SeriesDraft, 'id'> & { id: string };

/** Fields a conference edition takes over from its series: name and subtitle. */
function seriesDefaults(series: SeriesLike | undefined) {
	if (series?.kind !== 'CONFERENCE') return { name: '', subtitle: '' };
	return { name: series.shortName, subtitle: series.name };
}

/** Next year's edition of the first series, hidden until the photos are sorted. */
export function newEventDraft(series: SeriesLike | undefined, year: number): EventDraft {
	return {
		seriesId: series?.id ?? '',
		...seriesDefaults(series),
		edition: String(year),
		location: '',
		description: '',
		dateFrom: `${year}-03-01`,
		dateTo: '',
		datePrecision: 'MONTH',
		visibility: 'HIDDEN',
		rights: ''
	};
}

export const emptySeries = (): SeriesDraft => ({
	id: null,
	name: '',
	shortName: '',
	region: '',
	kind: 'CONFERENCE'
});

/** Only the editable fields, so extra columns never reach the mutation. */
export const toSeriesDraft = ({ id, name, shortName, region, kind }: SeriesLike): SeriesDraft => ({
	id,
	name,
	shortName,
	region,
	kind
});
