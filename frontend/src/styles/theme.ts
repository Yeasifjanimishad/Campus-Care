/**
 * CampusCare Design System - Single Source of Truth
 * Category-coded medical & emergency color tokens
 */

export const theme = {
  colors: {
    background: '#F7F9FB',
    surface: '#FFFFFF',
    ink: '#16232B',
    inkMuted: '#5B6B73',
    primary: '#1B4B66',
    primaryHover: '#13384D',
    illustrationBlue: '#29ABE2',
    medical: '#2E7DAF',
    medicalHover: '#24658F',
    emergency: '#D64550',
    emergencyHover: '#B8323D',
    wellness: '#3FA796',
    wellnessHover: '#33887B',
    warmAccent: '#F2A65A',
    warmAccentHover: '#E09243',
    border: '#E1E8EB',
  },

  fonts: {
    heading: '"Space Grotesk", sans-serif',
    body: '"IBM Plex Sans", sans-serif',
    mono: '"IBM Plex Mono", monospace',
  },
} as const;

export type Theme = typeof theme;


