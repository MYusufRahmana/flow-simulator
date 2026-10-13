import type { FlowProject } from '../types/flow';

const DB_NAME = 'flow-simulator';
const DB_VERSION = 1;
const STORE = 'projects';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error ?? req.error);
        tx.onabort = () => reject(tx.error ?? req.error);
      }),
  );
}

export const projectDb = {
  getAll: () => run<FlowProject[]>('readonly', (s) => s.getAll()),
  get: (id: string) => run<FlowProject | undefined>('readonly', (s) => s.get(id)),
  put: (project: FlowProject) => run<IDBValidKey>('readwrite', (s) => s.put(project)),
  delete: (id: string) => run<undefined>('readwrite', (s) => s.delete(id)),
};

/** Small preferences only — projects never go to localStorage. */
export const prefs = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`flowsim:${key}`);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(`flowsim:${key}`, JSON.stringify(value));
    } catch {
      /* storage unavailable — preferences are optional */
    }
  },
};
