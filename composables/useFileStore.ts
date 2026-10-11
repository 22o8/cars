const DB_NAME = 'tarabil-files'
const STORE = 'files'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function useFileStore() {
  async function saveFile(id: string, file: File) {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(file, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
  async function getFile(id: string): Promise<File | undefined> {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(id)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  async function openFile(id: string) {
    const file = await getFile(id)
    if (!file) return false
    const url = URL.createObjectURL(file)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return true
  }
  return { saveFile, getFile, openFile }
}
