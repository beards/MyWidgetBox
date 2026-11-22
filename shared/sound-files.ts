// Sound files the user picked from their device, kept in this browser. View-layer only; untested by
// design (manual check). Settings hold just a file's id (SoundSettings.file), so the file never travels
// with a Share link or an export file: other browsers fall back to the sound URL or the built-in sound.
import type { SoundFileSource } from './sound';

/**
 * Stored format (ADR-0004): IndexedDB database `mywidgetbox`, version 1, object store `soundFiles`;
 * key = the file's id (a random UUID), value = { name: the picked file's name, data: its Blob }.
 */
const DB_NAME = 'mywidgetbox';
const DB_VERSION = 1;
const STORE = 'soundFiles';

interface StoredSoundFile {
  name: string;
  data: Blob;
}

export const MAX_SOUND_FILE_BYTES = 5 * 1024 * 1024;

/** Why a picked file was not stored. */
export type SoundFileProblem = 'tooBig' | 'unplayable' | 'notStored';

export class SoundFileRejected extends Error {
  readonly problem: SoundFileProblem;

  constructor(problem: SoundFileProblem) {
    super(problem);
    this.problem = problem;
  }
}

export interface SoundFiles extends SoundFileSource {
  /** Stores a picked file and resolves with its id; rejects with SoundFileRejected. */
  add(file: File): Promise<string>;
  /** The stored file's name, or null when this browser does not have it. */
  nameOf(id: string): Promise<string | null>;
  /**
   * Deletes the stored files that no saved Settings of any Widget refer to any more, except `keep`
   * (the Settings in effect, which may come from a Share link and not be saved).
   */
  pruneUnused(keep: string[]): Promise<void>;
}

export function createStoredSoundFiles(): SoundFiles {
  let database: Promise<IDBDatabase> | null = null;
  /** Object URLs of the files read so far; null while reading or when this browser does not have the file. */
  const urls = new Map<string, string | null>();

  function open(): Promise<IDBDatabase> {
    database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return database;
  }

  async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  const read = (id: string) =>
    run<StoredSoundFile | undefined>('readonly', (store) => store.get(id)).catch(() => undefined);

  return {
    urlOf(id) {
      if (urls.has(id)) return urls.get(id)!;
      urls.set(id, null);
      void read(id).then((stored) => {
        if (stored) urls.set(id, URL.createObjectURL(stored.data));
      });
      return null;
    },
    async add(file) {
      if (file.size > MAX_SOUND_FILE_BYTES) throw new SoundFileRejected('tooBig');
      const url = URL.createObjectURL(file);
      if (!(await canPlay(url))) {
        URL.revokeObjectURL(url);
        throw new SoundFileRejected('unplayable');
      }
      const id = crypto.randomUUID();
      try {
        await run('readwrite', (store) => store.put({ name: file.name, data: file } satisfies StoredSoundFile, id));
      } catch {
        URL.revokeObjectURL(url);
        throw new SoundFileRejected('notStored');
      }
      urls.set(id, url);
      return id;
    },
    async nameOf(id) {
      return (await read(id))?.name ?? null;
    },
    async pruneUnused(keep) {
      try {
        const saved = savedText();
        const ids = await run('readonly', (store) => store.getAllKeys());
        const unused = ids.filter((id): id is string => typeof id === 'string' && !keep.includes(id) && !saved.includes(id));
        if (unused.length === 0) return;
        const db = await open();
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(STORE, 'readwrite');
          unused.forEach((id) => transaction.objectStore(STORE).delete(id));
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
        for (const id of unused) {
          const url = urls.get(id);
          if (url) URL.revokeObjectURL(url);
          urls.delete(id);
        }
      } catch {
        // Unreadable storage: keep everything rather than delete a file still in use.
      }
    },
  };
}

/**
 * Everything the site saved in localStorage, where file ids appear inside the Settings. Ids are random
 * UUIDs, so finding one in this text means some saved Settings (a Preset of any Widget) still use it.
 * Throws when localStorage cannot be read.
 */
function savedText(): string {
  let text = '';
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith('mywidgetbox:')) text += localStorage.getItem(key) ?? '';
  }
  return text;
}

/** Whether this browser can decode the file (some WAV encodings, for one, are not supported everywhere). */
function canPlay(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const done = (playable: boolean) => {
      clearTimeout(timer);
      audio.removeAttribute('src');
      resolve(playable);
    };
    const timer = setTimeout(() => done(false), 10_000);
    audio.addEventListener('loadedmetadata', () => done(true), { once: true });
    audio.addEventListener('error', () => done(false), { once: true });
    audio.src = url;
  });
}
