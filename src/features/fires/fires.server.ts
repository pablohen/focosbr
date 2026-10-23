// Bundled into the function: public/ isn't on its filesystem on Vercel.
import outlinesText from "../../../public/data/state-outlines.geojson?raw";
import {
	buildFiresResponse,
	type Detection,
	dailyFileUrl,
	daysForWindow,
	gapSlots,
	mergeDetections,
	parseInpeCsv,
	parseTenMinuteCsv,
	tenMinuteFileUrl,
} from "./inpe";
import { createStateLocator } from "./locate";
import type { FiresResponse, Window } from "./schemas";

/** INPE rewrites today's file through the day; older days barely change. */
const TODAY_TTL_MS = 5 * 60_000;
const PAST_DAY_TTL_MS = 60 * 60_000;
/** A published 10-minute file never changes; keep it while it can be in a gap. */
const GAP_FILE_TTL_MS = 7 * 60 * 60_000;

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

/** Parsed 10-minute files, per instance. Missing (not yet published) ones aren't kept. */
const gapFiles = new Map<string, Entry>();

let locate: ((lon: number, lat: number) => string | null) | undefined;

async function fetchGapFile(url: string): Promise<DayFile> {
	const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
	if (!res.ok) throw new Error(`INPE ${res.status} for ${url}`);
	locate ??= createStateLocator(JSON.parse(outlinesText));
	const modified = Date.parse(res.headers.get("last-modified") ?? "");
	return {
		detections: parseTenMinuteCsv(await res.text(), locate),
		updatedAt: Number.isNaN(modified) ? null : modified,
	};
}

/**
 * Detections INPE published every 10 minutes since `cutoff`, the daily
 * file's last rewrite. A file that's missing or fails is skipped: the gap
 * is a bonus, never a reason to fail the response.
 */
async function loadGap(cutoff: Date, now: Date): Promise<DayFile[]> {
	const loaded = await Promise.all(
		gapSlots(cutoff, now).map((slot) => {
			const url = tenMinuteFileUrl(slot);
			const cached = gapFiles.get(url);
			if (cached && cached.expires > now.getTime()) return cached.promise;
			const promise = fetchGapFile(url);
			const entry = { expires: now.getTime() + GAP_FILE_TTL_MS, promise };
			gapFiles.set(url, entry);
			return promise.catch((err) => {
				if (gapFiles.get(url) === entry) gapFiles.delete(url);
				// The newest slot is often not published yet; that's expected.
				if (!String(err).includes("INPE 404"))
					console.warn("10-minute file skipped:", err);
				return null;
			});
		}),
	);
	for (const [url, entry] of gapFiles)
		if (entry.expires < now.getTime()) gapFiles.delete(url);
	return loaded.filter((f): f is DayFile => f !== null);
}

/**
 * Hotspots detected in Brazil in the last `hours`: INPE's daily files, plus
 * the 10-minute files published since the current one was last rewritten.
 */
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
	// The gap starts at the current day's rewrite (yesterday's just after
	// midnight, before today's file exists). Not the newest of all files:
	// yesterday's is rewritten once more the next morning.
	const cutoff = days.findLast((d) => d.updatedAt !== null)?.updatedAt;
	const gap = cutoff ? await loadGap(new Date(cutoff), now) : [];
	const updated = [...days, ...gap]
		.map((d) => d.updatedAt)
		.filter((t): t is number => t !== null);
	return buildFiresResponse(
		mergeDetections(
			days.flatMap((d) => d.detections),
			gap.flatMap((f) => f.detections),
		),
		now,
		hours,
		updated.length ? new Date(Math.max(...updated)) : null,
	);
}
