/*
 * FocosBR's service worker: makes the site installable and keeps the last
 * view readable offline. Network first for pages and /api/fires (a deploy
 * or new data always wins; the cached copy is only for when the network
 * fails, and the page's freshness line then says how old it is). Hashed
 * build assets never change, so they're served from the cache first.
 */
const CACHE = "focosbr-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

async function networkFirst(request) {
	const cache = await caches.open(CACHE);
	try {
		const response = await fetch(request);
		if (response.ok) cache.put(request, response.clone());
		return response;
	} catch (err) {
		const cached = await cache.match(request, { ignoreVary: true });
		if (cached) return cached;
		throw err;
	}
}

async function cacheFirst(request) {
	const cache = await caches.open(CACHE);
	const cached = await cache.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	if (response.ok) cache.put(request, response.clone());
	return response;
}

self.addEventListener("fetch", (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== "GET" || url.origin !== self.location.origin) return;
	if (url.pathname.startsWith("/assets/")) {
		event.respondWith(cacheFirst(request));
		return;
	}
	if (request.mode === "navigate" || url.pathname === "/api/fires") {
		event.respondWith(networkFirst(request));
	}
});
