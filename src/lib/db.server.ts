import { type Db, MongoClient } from "mongodb";

/**
 * One MongoClient per server process. Cached on globalThis so Vite HMR
 * doesn't open a new connection pool on every module reload in dev.
 */
const globalForMongo = globalThis as typeof globalThis & {
	__mongoClient?: Promise<MongoClient>;
};

function connect(): Promise<MongoClient> {
	const uri = process.env.MONGODB_URI;
	if (!uri) return Promise.reject(new Error("MONGODB_URI is not set"));
	const client = new MongoClient(uri, {
		appName: "focosbr",
		maxPoolSize: 10,
		// Fail well within the 30 s function limit when the cluster is
		// unreachable; pages then show without history.
		serverSelectionTimeoutMS: 5_000,
		ignoreUndefined: true,
	});
	return client.connect();
}

export async function getDb(): Promise<Db> {
	globalForMongo.__mongoClient ??= connect().catch((err) => {
		// Don't cache a failed connection; let the next request retry.
		globalForMongo.__mongoClient = undefined;
		throw err;
	});
	const client = await globalForMongo.__mongoClient;
	return client.db(process.env.MONGODB_DB ?? "focosbr");
}

/** Closes the shared client (scripts). */
export async function closeDb(): Promise<void> {
	const pending = globalForMongo.__mongoClient;
	globalForMongo.__mongoClient = undefined;
	await (await pending)?.close();
}
