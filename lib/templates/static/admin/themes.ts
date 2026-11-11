import path from 'path';
import type { ThemeConfig } from 'adminjs' with { 'resolution-mode': 'import' };

/**
 * The panel's themes. Users pick one in the user menu (top right); the choice is remembered.
 * - Classic / Classic Dark: like Django's admin site - a list of sections, compact tables
 * - Modern / Modern Dark: cards and charts on the home page, rounded and roomy
 * - Light / Dark: AdminJS's own look
 * - Top Menu: no sidebar - the sections are menus in the top bar (components/TopBar.jsx)
 *
 * A theme is its colours (overrides) plus a stylesheet in src/admin/themes/<id>.css.
 * To add your own: copy a .css file, add an entry below, and add its id to THEME_IDS.
 */

// Read from src/ in TypeScript projects too (dist/admin -> ../../src/admin), like the components
const THEMES_DIR = path.join(__dirname, '..', '..', 'src', 'admin', 'themes');

const custom = (id: string, name: string, colors: Record<string, string>): ThemeConfig => ({
  id,
  name,
  overrides: { colors },
  bundlePath: path.join(THEMES_DIR, 'theme.bundle.js'),
  stylePath: path.join(THEMES_DIR, `${id}.css`),
});

/** Themes whose colours are dark - the login and password pages follow them too */
export const DARK_THEMES = ['dark', 'classic-dark', 'modern-dark'];

export const THEME_IDS = ['classic', 'classic-dark', 'modern', 'modern-dark', 'light', 'dark', 'top-menu'];

const darkBase = {
  grey100: '#CDCBD4',
  grey80: '#B6B5BC',
  grey60: '#8C8B90',
  grey40: '#151419',
  inputBorder: 'rgba(145, 158, 171, 0.32)',
  errorLight: '#C20012',
  successLight: '#007D7F',
  warningLight: '#A14F17',
  infoLight: '#3040D6',
};

/** adminjsThemes: the light and dark themes of @adminjs/themes */
export function availableThemes(adminjsThemes: Record<'light' | 'dark', ThemeConfig>): ThemeConfig[] {
  return [
    custom('classic', 'Classic', {
      primary100: '#417690',
      primary80: '#5b8aa3',
      primary60: '#79aec8',
      primary40: '#a7cbdd',
      primary20: '#e1edf4',
      accent: '#79aec8',
      bg: '#f8f8f8',
      container: '#ffffff',
      sidebar: '#ffffff',
      text: '#333333',
      grey100: '#333333',
      grey80: '#444444',
      grey60: '#666666',
      grey40: '#999999',
      grey20: '#e8e8e8',
      border: '#e8e8e8',
      filterBg: '#f8f8f8',
    }),
    custom('classic-dark', 'Classic Dark', {
      ...darkBase,
      primary100: '#4a8db0',
      primary80: '#5a9fbf',
      primary60: '#81d4fa',
      primary40: '#264b5d',
      primary20: '#1d3a48',
      accent: '#81d4fa',
      bg: '#121212',
      container: '#1e1e1e',
      sidebar: '#181818',
      text: '#eeeeee',
      border: '#2c2c2c',
      filterBg: '#1e1e1e',
    }),
    custom('modern', 'Modern', {
      primary100: '#4f46e5',
      primary80: '#6366f1',
      primary60: '#818cf8',
      primary40: '#a5b4fc',
      primary20: '#e0e7ff',
      accent: '#22c55e',
      bg: '#f3f4f8',
      container: '#ffffff',
      sidebar: '#ffffff',
      text: '#111827',
      grey100: '#111827',
      grey80: '#374151',
      grey60: '#6b7280',
      grey40: '#9ca3af',
      grey20: '#e5e7eb',
      border: '#e5e7eb',
      filterBg: '#ffffff',
    }),
    custom('modern-dark', 'Modern Dark', {
      ...darkBase,
      primary100: '#6366f1',
      primary80: '#818cf8',
      primary60: '#a5b4fc',
      primary40: '#312e81',
      primary20: '#1e1b4b',
      accent: '#22c55e',
      bg: '#0b0d14',
      container: '#141724',
      sidebar: '#10121c',
      text: '#f3f4f6',
      border: '#1f2230',
      filterBg: '#141724',
    }),
    { ...adminjsThemes.light, name: 'Light' },
    { ...adminjsThemes.dark, name: 'Dark' },
    // AdminJS's light colours; the sidebar is replaced by menus in the top bar
    // "text" is used by the menu buttons; AdminJS's light colours don't define it
    custom('top-menu', 'Top Menu', { text: '#0C1E29' }),
  ];
}

