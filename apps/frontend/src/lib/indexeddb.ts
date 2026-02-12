import { openDB } from "idb";
import type { IDBPDatabase } from "idb";
import type { Project } from "../types/project";

const DB_NAME = "strudel-flow";
const DB_VERSION = 3;
const STORE_PROJECTS = "projects";

export type StoredProject = Project & {
	ownerScope?: string;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB() {
	if (!dbPromise) {
			dbPromise = openDB(DB_NAME, DB_VERSION, {
				upgrade(db, oldVersion) {
					let store: IDBObjectStore;
					if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
						store = db.createObjectStore(STORE_PROJECTS, {
							keyPath: "id",
						});
						store.createIndex("createdAt", "createdAt");
						store.createIndex("updatedAt", "updatedAt");
					} else {
						const tx = db.transaction(STORE_PROJECTS, "readwrite");
						store = tx.objectStore(STORE_PROJECTS);
					}

					if (!store.indexNames.contains("ownerScope")) {
						store.createIndex("ownerScope", "ownerScope");
					}

					if (oldVersion < 3) {
						const request = store.openCursor();
						request.onsuccess = () => {
							const cursor = request.result;
							if (!cursor) return;
							const value = cursor.value as StoredProject;
							if (!value.ownerScope) {
								cursor.update({ ...value, ownerScope: "anon" });
							}
							cursor.continue();
						};
					}
				},
			});
		}
		return dbPromise;
}

export const indexedDB = {
	projects: {
		async getAll(scope?: string): Promise<StoredProject[]> {
			const db = await getDB();
			if (!db) return [];
			const all = await db.getAll(STORE_PROJECTS);
			if (!scope) return all;
			return all.filter((project) => (project.ownerScope ?? "anon") === scope);
		},

		async get(id: string, scope?: string): Promise<StoredProject | undefined> {
			const db = await getDB();
			if (!db) return undefined;
			const project = await db.get(STORE_PROJECTS, id);
			if (!project) return undefined;
			if (!scope) return project;
			return (project.ownerScope ?? "anon") === scope ? project : undefined;
		},

		async add(project: StoredProject, scope?: string): Promise<void> {
			const db = await getDB();
			if (!db) return;
			await db.put(STORE_PROJECTS, {
				...project,
				ownerScope: scope ?? project.ownerScope,
			});
		},

		async update(project: StoredProject, scope?: string): Promise<void> {
			const db = await getDB();
			if (!db) return;
			await db.put(STORE_PROJECTS, {
				...project,
				ownerScope: scope ?? project.ownerScope,
			});
		},

		async delete(id: string, scope?: string): Promise<void> {
			const db = await getDB();
			if (!db) return;
			if (!scope) {
				await db.delete(STORE_PROJECTS, id);
				return;
			}
			const project = await db.get(STORE_PROJECTS, id);
			if (!project) return;
			if ((project.ownerScope ?? "anon") !== scope) return;
			await db.delete(STORE_PROJECTS, id);
		},

		async clear(): Promise<void> {
			const db = await getDB();
			if (!db) return;
			await db.clear(STORE_PROJECTS);
		},
		async setMany(projects: StoredProject[], scope?: string): Promise<void> {
			const db = await getDB();
			if (!db) return;
			const tx = db.transaction(STORE_PROJECTS, "readwrite");
			for (const project of projects) {
				await tx.store.put({
					...project,
					ownerScope: scope ?? project.ownerScope,
				});
			}
			await tx.done;
		},
		async deleteScope(scope: string): Promise<void> {
			const db = await getDB();
			if (!db) return;
			const all = await db.getAll(STORE_PROJECTS);
			const tx = db.transaction(STORE_PROJECTS, "readwrite");
			for (const project of all) {
				if ((project.ownerScope ?? "anon") === scope) {
					await tx.store.delete(project.id);
				}
			}
			await tx.done;
		},
	},
};
