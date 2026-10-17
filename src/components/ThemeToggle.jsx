import { useTheme } from '../theme/ThemeProvider.jsx'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      className={`qc-theme-toggle ${className}`.trim()}
      aria-label={`Switch to ${nextTheme} background`}
      title={`Switch to ${nextTheme} background`}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
      <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  )
}
