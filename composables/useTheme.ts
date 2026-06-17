export const useTheme = () => {
  const theme = useState<'dark' | 'light'>('theme', () => 'light')

  function apply() {
    if (process.client) {
      document.documentElement.classList.toggle('dark', theme.value === 'dark')
      localStorage.setItem('adp_theme', theme.value)
    }
  }

  function initTheme() {
    if (process.client) {
      const saved = localStorage.getItem('adp_theme') as 'dark' | 'light' | null
      theme.value = saved || 'light'
      apply()
    }
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    apply()
  }

  return { theme, initTheme, toggleTheme, apply }
}
