export type ThemeName = 'light' | 'dark' | 'claude' | 'claude-dark' | 'minimal' | 'minimal-dark' | 'ocean';

interface Theme {
  id: ThemeName;
  name: string;
}

const themes: Theme[] = [
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
  { id: 'claude', name: 'Claude' },
  { id: 'claude-dark', name: 'Claude Dark' },
  { id: 'minimal', name: 'Minimal' },
  { id: 'minimal-dark', name: 'Minimal Dark' },
  { id: 'ocean', name: 'Ocean' },
];

interface ThemeSelectorProps {
  currentTheme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
}

export default function ThemeSelector({ currentTheme, onThemeChange }: ThemeSelectorProps) {
  return (
    <div className="theme-selector">
      {themes.map((theme) => (
        <button
          key={theme.id}
          className={`theme-btn ${currentTheme === theme.id ? 'active' : ''}`}
          data-theme={theme.id}
          onClick={() => onThemeChange(theme.id)}
          title={theme.name}
          aria-label={`Switch to ${theme.name} theme`}
        />
      ))}
    </div>
  );
}
