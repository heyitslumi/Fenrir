export type ThemePresetId = 'default' | 'ocean' | 'forest' | 'sunset' | 'custom';

export type ThemePalette = {
  light: Record<string, string>;
  dark: Record<string, string>;
};

export const THEME_PRESET_OPTIONS: Array<{ id: ThemePresetId; label: string }> = [
  { id: 'default', label: 'Default' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'forest', label: 'Forest' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'custom', label: 'Custom' },
];

export const THEME_PICKER_DEFAULTS = {
  lightPrimary: '#111827',
  darkPrimary: '#f4f4f5',
  lightAccent: '#f5f5f5',
  darkAccent: '#27272a',
  presets: {
    default: {
      lightPrimary: '#111827',
      darkPrimary: '#f4f4f5',
      lightAccent: '#f5f5f5',
      darkAccent: '#27272a',
    },
    ocean: {
      lightPrimary: '#2563eb',
      darkPrimary: '#7dd3fc',
      lightAccent: '#eff6ff',
      darkAccent: '#1e3a5f',
    },
    forest: {
      lightPrimary: '#2f855a',
      darkPrimary: '#86efac',
      lightAccent: '#ecfdf5',
      darkAccent: '#1f3b2b',
    },
    sunset: {
      lightPrimary: '#f97316',
      darkPrimary: '#fdba74',
      lightAccent: '#fff7ed',
      darkAccent: '#4a2c1a',
    },
  } satisfies Record<Exclude<ThemePresetId, 'custom'>, {
    lightPrimary: string;
    darkPrimary: string;
    lightAccent: string;
    darkAccent: string;
  }>,
};

export const THEME_PRESETS: Record<Exclude<ThemePresetId, 'custom'>, ThemePalette> = {
  default: {
    light: {
      '--primary': 'oklch(0.205 0 0)',
      '--accent': 'oklch(0.97 0 0)',
      '--sidebar-primary': 'oklch(0.205 0 0)',
    },
    dark: {
      '--primary': 'oklch(0.922 0 0)',
      '--accent': 'oklch(0.269 0 0)',
      '--sidebar-primary': 'oklch(0.488 0.243 264.376)',
    },
  },
  ocean: {
    light: {
      '--primary': 'oklch(0.57 0.18 245)',
      '--accent': 'oklch(0.95 0.03 230)',
      '--sidebar-primary': 'oklch(0.54 0.19 245)',
    },
    dark: {
      '--primary': 'oklch(0.75 0.14 240)',
      '--accent': 'oklch(0.33 0.06 235)',
      '--sidebar-primary': 'oklch(0.72 0.15 242)',
    },
  },
  forest: {
    light: {
      '--primary': 'oklch(0.56 0.16 150)',
      '--accent': 'oklch(0.94 0.03 155)',
      '--sidebar-primary': 'oklch(0.54 0.15 150)',
    },
    dark: {
      '--primary': 'oklch(0.76 0.12 150)',
      '--accent': 'oklch(0.32 0.05 150)',
      '--sidebar-primary': 'oklch(0.7 0.12 150)',
    },
  },
  sunset: {
    light: {
      '--primary': 'oklch(0.64 0.2 35)',
      '--accent': 'oklch(0.95 0.04 45)',
      '--sidebar-primary': 'oklch(0.62 0.2 35)',
    },
    dark: {
      '--primary': 'oklch(0.78 0.16 45)',
      '--accent': 'oklch(0.34 0.06 40)',
      '--sidebar-primary': 'oklch(0.75 0.16 44)',
    },
  },
};

export function normalizePreset(raw?: string | null): ThemePresetId {
  if (raw === 'ocean' || raw === 'forest' || raw === 'sunset' || raw === 'custom') {
    return raw;
  }
  return 'default';
}

export function resolveThemePalette(options: {
  preset: ThemePresetId;
  customLightPrimary?: string;
  customDarkPrimary?: string;
  customLightAccent?: string;
  customDarkAccent?: string;
}): ThemePalette {
  const defaultLight = THEME_PRESETS.default.light;
  const defaultDark = THEME_PRESETS.default.dark;

  if (options.preset !== 'custom') {
    return THEME_PRESETS[options.preset as Exclude<ThemePresetId, 'custom'>] ?? THEME_PRESETS.default;
  }

  return {
    light: {
      '--primary': options.customLightPrimary || defaultLight['--primary'] || 'oklch(0.205 0 0)',
      '--accent': options.customLightAccent || defaultLight['--accent'] || 'oklch(0.97 0 0)',
      '--sidebar-primary': options.customLightPrimary || defaultLight['--sidebar-primary'] || 'oklch(0.205 0 0)',
    },
    dark: {
      '--primary': options.customDarkPrimary || defaultDark['--primary'] || 'oklch(0.922 0 0)',
      '--accent': options.customDarkAccent || defaultDark['--accent'] || 'oklch(0.269 0 0)',
      '--sidebar-primary': options.customDarkPrimary || defaultDark['--sidebar-primary'] || 'oklch(0.488 0.243 264.376)',
    },
  };
}

export function buildThemeCss(palette: ThemePalette): string {
  const lightVars = Object.entries(palette.light)
    .map(([key, value]) => `${key}: ${value};`)
    .join(' ');
  const darkVars = Object.entries(palette.dark)
    .map(([key, value]) => `${key}: ${value};`)
    .join(' ');

  return `:root { ${lightVars} } .dark { ${darkVars} }`;
}
