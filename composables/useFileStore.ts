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
  async function saveFile(id: string, file: Blob) {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(file, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async function getFile(id: string): Promise<Blob | undefined> {
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

  async function downloadFile(id: string, filename: string) {
    const file = await getFile(id)
    if (!file) return false
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return true
  }

  async function imageToPngBytes(blob: Blob): Promise<ArrayBuffer> {
    const url = URL.createObjectURL(blob)
    try {
      const img = new Image()
      img.src = url
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('تعذر قراءة الصورة'))
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('تعذر تجهيز الصورة')
      ctx.drawImage(img, 0, 0)
      const out = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('تعذر تحويل الصورة')), 'image/png'))
      return await out.arrayBuffer()
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  async function mergeToPdf(fileIds: string[]): Promise<Blob> {
    const { PDFDocument } = await import('pdf-lib')
    const output = await PDFDocument.create()
    for (const id of fileIds) {
      const blob = await getFile(id)
      if (!blob) continue
      try {
        const sourceName = String((blob as any).name || '').toLowerCase()
        if (blob.type === 'application/pdf' || blob.type.includes('pdf') || sourceName.endsWith('.pdf')) {
          const src = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })
          const pages = await output.copyPages(src, src.getPageIndices())
          pages.forEach(p => output.addPage(p))
          continue
        }
        if (blob.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(sourceName)) {
          let image
          if (blob.type === 'image/jpeg' || blob.type === 'image/jpg' || /\.jpe?g$/i.test(sourceName)) image = await output.embedJpg(await blob.arrayBuffer())
          else if (blob.type === 'image/png' || sourceName.endsWith('.png')) image = await output.embedPng(await blob.arrayBuffer())
          else image = await output.embedPng(await imageToPngBytes(blob))
          const pageWidth = 595.28
          const pageHeight = 841.89
          const margin = 20
          const scale = Math.min((pageWidth - margin * 2) / image.width, (pageHeight - margin * 2) / image.height)
          const w = image.width * scale
          const h = image.height * scale
          const page = output.addPage([pageWidth, pageHeight])
          page.drawImage(image, { x: (pageWidth - w) / 2, y: (pageHeight - h) / 2, width: w, height: h })
        }
      } catch {
        // نتجاوز الملف غير القابل للدمج بدون تعطيل بقية المعاملة.
      }
    }
    const bytes = await output.save()
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    return new Blob([ab], { type: 'application/pdf' })
  }

  return { saveFile, getFile, openFile, downloadFile, mergeToPdf }
}
