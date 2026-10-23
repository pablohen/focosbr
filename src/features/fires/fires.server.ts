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

type Entry = { expires: number; promise: Promise<Detection[]> };

/** Parsed daily files, per instance. Concurrent requests share one fetch. */
const files = new Map<string, Entry>();

async function fetchDay(url: string): Promise<Detection[]> {
	const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
	// Right after 00:00 UTC today's file doesn't exist yet.
	if (res.status === 404) return [];
	if (!res.ok) throw new Error(`INPE ${res.status} for ${url}`);
	return parseInpeCsv(await res.text());
}

function loadDay(day: Date, now: Date): Promise<Detection[]> {
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
	return buildFiresResponse(days.flat(), now, hours);
}
