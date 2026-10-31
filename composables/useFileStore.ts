const DB_NAME = 'tarabil-files'
const STORE = 'files'
const CLOUD_CHUNK_BYTES = 192 * 1024

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step))
  return btoa(binary)
}


async function fetchRetry<T=any>(url: string, options: any = {}, attempts = 3): Promise<T> {
  let last: any
  for (let i = 0; i < attempts; i++) {
    try { return await $fetch<T>(url, options) } catch (e) { last = e; if (i + 1 < attempts) await new Promise(r => setTimeout(r, 250 * (i + 1))) }
  }
  throw last
}

function base64ToBytes(data: string) {
  const binary = atob(data)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function useFileStore() {
  async function saveLocal(id: string, file: Blob) {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(file, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async function getLocal(id: string): Promise<Blob | undefined> {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(id)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async function uploadCloud(id: string, file: Blob) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const chunks = Math.ceil(bytes.length / CLOUD_CHUNK_BYTES)
    await fetchRetry(`/api/files/${encodeURIComponent(id)}/init`, { method:'POST', body:{ mime:file.type || 'application/octet-stream', size:bytes.length, chunks } })
    for (let index = 0; index < chunks; index++) {
      const part = bytes.subarray(index * CLOUD_CHUNK_BYTES, Math.min(bytes.length, (index + 1) * CLOUD_CHUNK_BYTES))
      await fetchRetry(`/api/files/${encodeURIComponent(id)}/chunk`, { method:'POST', body:{ index, data:bytesToBase64(part) } })
    }
  }

  async function downloadCloud(id: string): Promise<Blob | undefined> {
    try {
      const meta:any = await fetchRetry(`/api/files/${encodeURIComponent(id)}/meta`, { cache:'no-store' as any })
      const chunks = Number(meta?.chunks || 0)
      if (chunks < 0 || chunks > 400) return undefined
      const parts: Uint8Array[] = []
      let total = 0
      for (let index = 0; index < chunks; index++) {
        const r:any = await fetchRetry(`/api/files/${encodeURIComponent(id)}/chunk/${index}`,  { cache:'no-store' as any })
        const bytes = base64ToBytes(String(r?.data || ''))
        parts.push(bytes); total += bytes.length
      }
      const all = new Uint8Array(total)
      let offset = 0
      for (const part of parts) { all.set(part, offset); offset += part.length }
      const blob = new Blob([all], { type:String(meta?.mime || 'application/octet-stream') })
      await saveLocal(id, blob)
      return blob
    } catch { return undefined }
  }

  async function saveFile(id: string, file: Blob) {
    await saveLocal(id, file)
    try { await uploadCloud(id, file) }
    catch (e) {
      console.warn('[Tarabil Files] cloud upload failed', e)
      throw new Error('تم حفظ الملف على هذا الجهاز لكن تعذر رفعه للسحابة. تحقق من الاتصال وحاول مرة أخرى.')
    }
  }

  async function migrateLocalFiles(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))]
    for (const id of unique) {
      const local = await getLocal(id)
      if (!local) continue
      try {
        await fetchRetry(`/api/files/${encodeURIComponent(id)}/meta`, { cache:'no-store' as any }, 1)
      } catch {
        try { await uploadCloud(id, local) } catch {}
      }
    }
  }

  async function getFile(id: string): Promise<Blob | undefined> {
    const local = await getLocal(id)
    if (local) {
      // Existing files from older versions are migrated lazily without delaying the user.
      void $fetch(`/api/files/${encodeURIComponent(id)}/meta`, { cache:'no-store' as any }).catch(() => uploadCloud(id, local).catch(()=>{}))
      return local
    }
    return await downloadCloud(id)
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
    const a = document.createElement('a'); a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return true
  }

  async function imageToPngBytes(blob: Blob): Promise<ArrayBuffer> {
    const url = URL.createObjectURL(blob)
    try {
      const img = new Image(); img.src = url
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('تعذر قراءة الصورة')) })
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth || img.width; canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('تعذر تجهيز الصورة')
      ctx.drawImage(img, 0, 0)
      const out = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('تعذر تحويل الصورة')), 'image/png'))
      return await out.arrayBuffer()
    } finally { URL.revokeObjectURL(url) }
  }

  async function mergeToPdf(fileIds: string[]): Promise<Blob> {
    const { PDFDocument } = await import('pdf-lib')
    const output = await PDFDocument.create()
    for (const id of fileIds) {
      const blob = await getFile(id); if (!blob) continue
      try {
        const sourceName = String((blob as any).name || '').toLowerCase()
        if (blob.type === 'application/pdf' || blob.type.includes('pdf') || sourceName.endsWith('.pdf')) {
          const src = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })
          const pages = await output.copyPages(src, src.getPageIndices()); pages.forEach(p => output.addPage(p)); continue
        }
        if (blob.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(sourceName)) {
          let image
          if (blob.type === 'image/jpeg' || blob.type === 'image/jpg' || /\.jpe?g$/i.test(sourceName)) image = await output.embedJpg(await blob.arrayBuffer())
          else if (blob.type === 'image/png' || sourceName.endsWith('.png')) image = await output.embedPng(await blob.arrayBuffer())
          else image = await output.embedPng(await imageToPngBytes(blob))
          const pageWidth = 595.28, pageHeight = 841.89, margin = 20
          const scale = Math.min((pageWidth - margin * 2) / image.width, (pageHeight - margin * 2) / image.height)
          const w = image.width * scale, h = image.height * scale
          const page = output.addPage([pageWidth, pageHeight])
          page.drawImage(image, { x:(pageWidth-w)/2, y:(pageHeight-h)/2, width:w, height:h })
        }
      } catch {}
    }
    const bytes = await output.save()
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    return new Blob([ab], { type:'application/pdf' })
  }

  return { saveFile, getFile, openFile, downloadFile, mergeToPdf, migrateLocalFiles }
}
