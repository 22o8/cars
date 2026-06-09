const fs = require('fs')
const path = require('path')
for (const dir of ['.nuxt', '.output', 'node_modules/.vite']) {
  const target = path.join(process.cwd(), dir)
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true })
}
