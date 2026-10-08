import { browser } from '$app/environment';

export type Theme = 'system' | 'dark' | 'light';
export const themes = ['system', 'light', 'dark'] as const;

let theme: Theme = $state('system');

export function initialSetTheme() {
	setThemeInHTML(getTheme());
}

export function setThemeInHTML(newTheme: Theme) {
	const html = document.querySelector('html');
	if (!html) return;
	if (newTheme === 'system') {
		newTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}
	html.setAttribute('data-theme', newTheme);
}

export function setTheme(newTheme: Theme) {
	if (!browser) return;
	localStorage.setItem('theme', newTheme);
	theme = newTheme;
	setThemeInHTML(newTheme);
}

export function getTheme(): Theme {
	if (!browser) return theme;
	const stored = localStorage.getItem('theme');
	theme = stored && (themes as readonly string[]).includes(stored) ? (stored as Theme) : 'system';
	return theme;
}

export function toggleTheme() {
	const next = themes[(themes.indexOf(getTheme()) + 1) % themes.length];
	setTheme(next);
	return next;
}
