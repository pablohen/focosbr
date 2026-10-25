/**
 * Registers public/sw.js (installable app, last view offline). Production
 * only: in development it would cache Vite's modules and fight HMR.
 */
export function registerServiceWorker() {
	if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
	navigator.serviceWorker.register("/sw.js").catch((err: unknown) => {
		console.warn("service worker registration failed:", err);
	});
}
