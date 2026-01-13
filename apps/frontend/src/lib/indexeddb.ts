import { openDB } from "idb";
import type { IDBPDatabase } from "idb";
import type { Project } from "../types/project";

const DB_NAME = "strudel-flow";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";

export type StoredProject = Project;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB() {
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
					const store = db.createObjectStore(STORE_PROJECTS, {
						keyPath: "id",
					});
					store.createIndex("createdAt", "createdAt");
					store.createIndex("updatedAt", "updatedAt");
				}
			},
		});
	}
	return dbPromise;
}

export const indexedDB = {
	projects: {
		async getAll(): Promise<StoredProject[]> {
			const db = await getDB();
			if (!db) return [];
			return db.getAll(STORE_PROJECTS);
		},

		async get(id: string): Promise<StoredProject | undefined> {
			const db = await getDB();
			if (!db) return undefined;
			return db.get(STORE_PROJECTS, id);
		},

		async add(project: StoredProject): Promise<void> {
			const db = await getDB();
			if (!db) return;
			await db.put(STORE_PROJECTS, project);
		},

		async update(project: StoredProject): Promise<void> {
			const db = await getDB();
			if (!db) return;
			await db.put(STORE_PROJECTS, project);
		},

		async delete(id: string): Promise<void> {
			const db = await getDB();
			if (!db) return;
			await db.delete(STORE_PROJECTS, id);
		},

		async clear(): Promise<void> {
			const db = await getDB();
			if (!db) return;
			await db.clear(STORE_PROJECTS);
		},
		async setMany(projects: StoredProject[]): Promise<void> {
			const db = await getDB();
			if (!db) return;
			const tx = db.transaction(STORE_PROJECTS, "readwrite");
			for (const project of projects) {
				await tx.store.put(project);
			}
			await tx.done;
		},
	},
};
