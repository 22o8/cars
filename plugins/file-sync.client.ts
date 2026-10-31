export default defineNuxtPlugin(() => {
  const { transactions } = useTransactions()
  const { migrateLocalFiles } = useFileStore()
  const started = useState<boolean>('legacyFileMigrationStartedV1', () => false)
  if (started.value) return
  started.value = true
  setTimeout(async () => {
    const ids = transactions.value.flatMap(t => (t.attachments || []).map(a => a.id)).filter(Boolean)
    if (ids.length) await migrateLocalFiles(ids)
  }, 5000)
})
