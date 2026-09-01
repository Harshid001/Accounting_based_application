import { Moon, Sun } from 'lucide-react';

import { IconButton } from '@/components/ui/icon-button';
import { useTheme } from '@/context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme';

  return (
    <IconButton
      label={nextLabel}
      onClick={toggleTheme}
      icon={
        theme === 'dark' ? (
          <Sun size={16} aria-hidden="true" />
        ) : (
          <Moon size={16} aria-hidden="true" />
        )
      }
    />
  );
}
