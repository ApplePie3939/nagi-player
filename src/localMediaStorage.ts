import type { PlaylistItem } from './types';

const DATABASE_NAME = 'nagi-player';
const STORE_NAME = 'local-media';
const DATABASE_VERSION = 1;

export type StoredLocalMedia = {
  id: string;
  title: string;
  kind: PlaylistItem['kind'];
  hidden: boolean;
  file: Blob;
};

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onerror = () => reject(request.error ?? new Error('IndexedDB を開けませんでした。'));
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  };
  request.onsuccess = () => resolve(request.result);
});

const runTransaction = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      let result: T;
      transaction.onerror = () => reject(transaction.error ?? new Error('端末内のファイルを保存できませんでした。'));
      transaction.onabort = () => reject(transaction.error ?? new Error('端末内のファイルを保存できませんでした。'));
      transaction.oncomplete = () => resolve(result);
      request.onerror = () => reject(request.error ?? new Error('端末内のファイルを保存できませんでした。'));
      request.onsuccess = () => { result = request.result; };
    });
  } finally {
    database.close();
  }
};

export const loadLocalMedia = () => runTransaction('readonly', store => store.getAll());
export const saveLocalMedia = (item: StoredLocalMedia) => runTransaction('readwrite', store => store.put(item));
export const deleteLocalMedia = (id: string) => runTransaction('readwrite', store => store.delete(id));
export const setLocalMediaHidden = async (id: string, hidden: boolean) => {
  const item = await runTransaction('readonly', store => store.get(id));
  if (!item) return;
  await saveLocalMedia({ ...item, hidden });
};
