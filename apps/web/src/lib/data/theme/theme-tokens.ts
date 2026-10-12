/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Every colour a theme can set, with the CSS variable it drives. The settings
 * editor and themes.md are organised by these groups. Not part of upstream.
 */

export interface ThemeTokenInfo {
  label: string;
  cssVar: string;
  description: string;
}

export const themeTokenGroups = {
  App: {
    background: {
      label: 'Background',
      cssVar: '--background-color',
      description: 'Page background of the library, settings and statistics'
    },
    surface: {
      label: 'Surface',
      cssVar: '--surface-color',
      description: 'Cards and panels (bottom of their gradient)'
    },
    surfaceStrong: {
      label: 'Surface (strong)',
      cssVar: '--surface-strong-color',
      description: 'Cards and panels (top of their gradient), popovers, dialogs'
    },
    text: { label: 'Text', cssVar: '--font-color', description: 'Main text colour' },
    mutedText: {
      label: 'Muted text',
      cssVar: '--app-muted-fg',
      description: 'Secondary text such as hints and counts'
    },
    border: { label: 'Border', cssVar: '--border-color', description: 'Card and divider borders' },
    shadow: { label: 'Shadow', cssVar: '--shadow-color', description: 'Drop shadows' },
    insetHighlight: {
      label: 'Inset highlight',
      cssVar: '--app-inset-highlight',
      description: 'The thin light line along the top edge of cards'
    },
    accent: {
      label: 'Accent',
      cssVar: '--accent-color',
      description: 'Active items, progress bars, focus rings'
    },
    accentStrong: {
      label: 'Accent (strong)',
      cssVar: '--accent-strong-color',
      description: 'Accent used for text and icons'
    },
    accentText: {
      label: 'Text on accent',
      cssVar: '--app-accent-fg',
      description: 'Text placed on an accent background'
    },
    control: {
      label: 'Controls',
      cssVar: '--app-control-bg',
      description: 'Inputs, tabs and buttons'
    },
    controlBorder: {
      label: 'Control border',
      cssVar: '--app-control-border',
      description: 'Borders of inputs, tabs and buttons'
    },
    danger: {
      label: 'Danger',
      cssVar: '--app-danger-color',
      description: 'Delete actions and errors'
    },
    overlay: {
      label: 'Dialog backdrop',
      cssVar: '--app-overlay-color',
      description: 'Dims the page behind dialogs'
    },
    scrollbar: {
      label: 'Scrollbar',
      cssVar: '--app-scrollbar-color',
      description: 'Scrollbar thumb'
    }
  },
  Header: {
    headerBackground: {
      label: 'Header background',
      cssVar: '--app-header-bg',
      description: 'Top bar and library sidebar (glass, keep it slightly transparent)'
    },
    headerText: {
      label: 'Header text',
      cssVar: '--app-header-fg',
      description: 'Titles in the top bar'
    },
    headerBorder: {
      label: 'Header border',
      cssVar: '--app-header-border',
      description: 'Line below the top bar'
    },
    headerIcon: {
      label: 'Header icons',
      cssVar: '--app-header-icon-fg',
      description: 'Icon buttons'
    },
    headerIconBackground: {
      label: 'Header icon background',
      cssVar: '--app-header-icon-bg',
      description: 'Pill behind grouped icon buttons'
    },
    headerIconBorder: {
      label: 'Header icon border',
      cssVar: '--app-header-icon-border',
      description: 'Outline of the icon pill'
    },
    headerIconHover: {
      label: 'Header icon hover',
      cssVar: '--app-header-icon-hover-bg',
      description: 'Icon button hover and active state'
    }
  },
  Reader: {
    readerText: {
      label: 'Book text',
      cssVar: '--reader-text-color',
      description: 'Text of the book'
    },
    readerBackground: {
      label: 'Book background',
      cssVar: '--reader-background-color',
      description: 'Page colour while reading'
    },
    selectionText: {
      label: 'Selection text',
      cssVar: '--reader-selection-color',
      description: 'Selected text in the book'
    },
    selectionBackground: {
      label: 'Selection background',
      cssVar: '--reader-selection-bg',
      description: 'Background of selected text'
    },
    furiganaHintText: {
      label: 'Furigana (partially hidden)',
      cssVar: '--reader-furigana-hint-color',
      description: 'Furigana when the "partial" furigana style is on'
    },
    furiganaHintShadow: {
      label: 'Furigana cover',
      cssVar: '--reader-furigana-shadow-color',
      description: 'Shadow that hides furigana until hovered'
    },
    footerText: {
      label: 'Footer text',
      cssVar: '--reader-footer-color',
      description: 'Progress and character counter at the bottom'
    },
    panelBackground: {
      label: 'Overlay panels',
      cssVar: '--reader-panel-bg',
      description: 'Read aloud player, Ask AI, search, notes and the selection toolbar'
    },
    panelText: {
      label: 'Overlay panel text',
      cssVar: '--reader-panel-fg',
      description: 'Text in those panels'
    }
  },
  Annotations: {
    highlightYellow: {
      label: 'Highlight 1 (yellow)',
      cssVar: '--highlight-yellow',
      description: 'First highlight colour'
    },
    highlightGreen: {
      label: 'Highlight 2 (green)',
      cssVar: '--highlight-green',
      description: 'Second highlight colour'
    },
    highlightBlue: {
      label: 'Highlight 3 (blue)',
      cssVar: '--highlight-blue',
      description: 'Third highlight colour'
    },
    highlightPink: {
      label: 'Highlight 4 (pink)',
      cssVar: '--highlight-pink',
      description: 'Fourth highlight colour'
    },
    searchMatch: {
      label: 'Search match',
      cssVar: '--search-match-color',
      description: 'The search result you jumped to'
    },
    readingLine: {
      label: 'Line being read',
      cssVar: '--reading-line-color',
      description: 'What the audiobook or AI voice is reading'
    }
  }
} as const satisfies Record<string, Record<string, ThemeTokenInfo>>;

export type ThemeTokenGroup = keyof typeof themeTokenGroups;

type GroupTokens<G extends ThemeTokenGroup> = keyof (typeof themeTokenGroups)[G];

export type ThemeToken = { [G in ThemeTokenGroup]: GroupTokens<G> }[ThemeTokenGroup];

export type ThemeColors = Record<ThemeToken, string>;

export interface ThemeTokenEntry extends ThemeTokenInfo {
  token: ThemeToken;
}

export const themeTokensByGroup: { group: ThemeTokenGroup; tokens: ThemeTokenEntry[] }[] =
  Object.entries(themeTokenGroups).map(([group, tokens]) => ({
    group: group as ThemeTokenGroup,
    tokens: Object.entries(tokens as Record<string, ThemeTokenInfo>).map(([token, info]) => ({
      token: token as ThemeToken,
      ...info
    }))
  }));

export const themeTokens: ThemeTokenEntry[] = themeTokensByGroup.flatMap(({ tokens }) => tokens);
