export const cloudFileMetaKey = (id: string) => `tarabil:shared:file:${id}:meta`
export const cloudFileChunkKey = (id: string, index: number) => `tarabil:shared:file:${id}:chunk:${index}`
