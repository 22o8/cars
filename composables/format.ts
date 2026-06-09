export function money(value: any, currency = 'IQD') {
  const n = Number(value || 0)
  const label = currency === 'USD' ? '$' : 'د.ع'
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)} ${label}`
}

export function compactMoney(value: any, currency = 'IQD') {
  const n = Number(value || 0)
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const label = currency === 'USD' ? '$' : 'د.ع'
  let text = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(abs)
  if (abs >= 1_000_000_000) text = `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(abs / 1_000_000_000)}B`
  else if (abs >= 1_000_000) text = `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(abs / 1_000_000)}M`
  else if (abs >= 1_000) text = `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(abs / 1_000)}K`
  return `${sign}${text} ${label}`
}

export function dateText(value: any) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('ar-IQ')
}

export function dateTimeText(value: any) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ar-IQ')
}

export function roleText(role: string) {
  return ({ ADMIN: 'مدير', ACCOUNTANT: 'محاسب', SALES: 'مبيعات', VIEWER: 'مشاهدة' } as any)[role] || role
}
