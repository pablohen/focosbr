import {
	buildFiresResponse,
	type Detection,
	dailyFileUrl,
	daysForWindow,
	parseInpeCsv,
} from "./inpe";
import type { FiresResponse, Window } from "./schemas";

/** INPE rewrites today's file about every 10 minutes; older days barely change. */
const TODAY_TTL_MS = 5 * 60_000;
const PAST_DAY_TTL_MS = 60 * 60_000;

/** A parsed daily file, with when INPE last rewrote it (null if unknown). */
type DayFile = { detections: Detection[]; updatedAt: number | null };
type Entry = { expires: number; promise: Promise<DayFile> };

/** Parsed daily files, per instance. Concurrent requests share one fetch. */
const files = new Map<string, Entry>();

async function fetchDay(url: string): Promise<DayFile> {
	const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
	// Right after 00:00 UTC today's file doesn't exist yet.
	if (res.status === 404) return { detections: [], updatedAt: null };
	if (!res.ok) throw new Error(`INPE ${res.status} for ${url}`);
	const modified = Date.parse(res.headers.get("last-modified") ?? "");
	return {
		detections: parseInpeCsv(await res.text()),
		updatedAt: Number.isNaN(modified) ? null : modified,
	};
}

function loadDay(day: Date, now: Date): Promise<DayFile> {
	const url = dailyFileUrl(day);
	const cached = files.get(url);
	if (cached && cached.expires > now.getTime()) return cached.promise;

	const isToday =
		day.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
	const promise = fetchDay(url);
	const entry = {
		expires: now.getTime() + (isToday ? TODAY_TTL_MS : PAST_DAY_TTL_MS),
		promise,
	};
	files.set(url, entry);
	// Failures aren't cached; keep serving the previous copy if there was one.
	promise.catch(() => {
		if (files.get(url) === entry) {
			if (cached) files.set(url, cached);
			else files.delete(url);
		}
	});
	return cached ? promise.catch(() => cached.promise) : promise;
}

/** Hotspots detected in Brazil in the last `hours`, from INPE's daily files. */
export async function getFires(
	hours: Window,
	now = new Date(),
): Promise<FiresResponse> {
	const days = await Promise.all(
		daysForWindow(now, hours).map((day) => loadDay(day, now)),
	);
	// Old entries for days that left every window.
	for (const [url, entry] of files)
		if (entry.expires < now.getTime() - PAST_DAY_TTL_MS) files.delete(url);
	// The newest rewrite of any file: today's, or yesterday's just after midnight.
	const updated = days
		.map((d) => d.updatedAt)
		.filter((t): t is number => t !== null);
	return buildFiresResponse(
		days.flatMap((d) => d.detections),
		now,
		hours,
		updated.length ? new Date(Math.max(...updated)) : null,
	);
}
