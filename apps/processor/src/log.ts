type Level = 'debug' | 'info' | 'warn' | 'error';

/** One line per event, JSON when not attached to a TTY so container logs stay parseable. */
export function log(level: Level, message: string, fields: Record<string, unknown> = {}) {
	const entry = { time: new Date().toISOString(), level, message, ...fields };
	const line = process.stdout.isTTY
		? `[processor] ${level.padEnd(5)} ${message} ${Object.keys(fields).length ? JSON.stringify(fields) : ''}`
		: JSON.stringify(entry);
	(level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}
