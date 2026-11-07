// Each theme's colours, fonts, and decorations live in src/themes/<id>.css, scoped to
// [data-theme="<id>"] on <html>. This registry holds what scripts need: the label, whether the
// theme is light or dark, and a few colours for the picker's swatch.
export interface Theme {
  id: string;
  label: string;
  scheme: 'light' | 'dark';
  // Background, panel, and accent colours, shown in the theme picker.
  swatch: [string, string, string];
}

// In the order the theme picker lists them.
export const THEMES: Theme[] = [
  {
    id: 'classic',
    label: 'Classic',
    scheme: 'light',
    swatch: ['#ffffff', '#f8fafc', '#047857'],
  },
  {
    id: 'diner50s',
    label: '1950s · Atomic Diner',
    scheme: 'dark',
    swatch: ['#0b1630', '#40e0d0', '#ff4f6a'],
  },
  {
    id: 'mod60s',
    label: '1960s · Mod Pop-Art',
    scheme: 'light',
    swatch: ['#fffaf0', '#ff6b1a', '#00897b'],
  },
  {
    id: 'groovy70s',
    label: '1970s · Groovy Sunset',
    scheme: 'light',
    swatch: ['#f6ead2', '#c8541a', '#788c32'],
  },
  {
    id: 'retro80s',
    label: '1980s · Retro',
    scheme: 'dark',
    swatch: ['#1a0838', '#170d30', '#ff2bd6'],
    // Neon syntax colours on a deep violet background.
  },
  {
    id: 'desktop90s',
    label: '1990s · Desktop',
    scheme: 'light',
    swatch: ['#008080', '#c0c0c0', '#000080'],
  },
  {
    id: 'aero00s',
    label: '2000s · Frutiger Aero',
    scheme: 'light',
    swatch: ['#7fc8ff', '#ffffff', '#7ed321'],
  },
  {
    id: 'flat10s',
    label: '2010s · Flat Material',
    scheme: 'light',
    swatch: ['#eceff1', '#ffffff', '#3f51b5'],
  },
  {
    id: 'aurora20s',
    label: '2020s · Aurora Glass',
    scheme: 'dark',
    swatch: ['#0a0b14', '#8b7cf6', '#5eead4'],
  },
  {
    id: 'aurora20s-light',
    label: '2020s · Aurora Glass (light)',
    scheme: 'light',
    swatch: ['#f5f6fb', '#7c3aed', '#0f766e'],
  },
];

export const DEFAULT_THEME_ID = 'retro80s';

export function themeById(id: string | null | undefined): Theme {
  return (
    THEMES.find((theme) => theme.id === id) ?? THEMES.find(({ id }) => id === DEFAULT_THEME_ID)!
  );
}
