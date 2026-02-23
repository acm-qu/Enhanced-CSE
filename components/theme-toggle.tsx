'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

import { Switch } from '@/components/ui/switch';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === 'dark';

  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-foreground/15 bg-foreground/5 px-2 py-1 text-[10px] uppercase tracking-[0.12em]">
      <span>{mounted && isDark ? 'Dark' : 'Light'}</span>
      <Switch
        aria-label="Toggle dark mode"
        checked={mounted ? isDark : false}
        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
      />
    </label>
  );
}
