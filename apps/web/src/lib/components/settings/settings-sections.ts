/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Settings navigation (sidebar areas and their sections), modeled on
 * app.yatsu.moe/settings. Section ids are the anchors in the URL:
 * /settings?section=<area>#<section id>. Not part of upstream.
 */

import {
  faBookOpen,
  faBookmark,
  faBullseye,
  faChartLine,
  faClockRotateLeft,
  faCodeMerge,
  faCommentDots,
  faDatabase,
  faDisplay,
  faFileImport,
  faFont,
  faHandPointer,
  faHardDrive,
  faHeadphones,
  faLanguage,
  faListUl,
  faPalette,
  faRotate,
  faServer,
  faSliders,
  faStopwatch,
  faSun,
  faSwatchbook,
  faTableColumns,
  faUser,
  faWandMagicSparkles
} from '@fortawesome/free-solid-svg-icons';
import { getContext, setContext } from 'svelte';
import type { Writable } from 'svelte/store';

type Icon = typeof faUser;

export interface SettingsSectionInfo {
  id: string;
  label: string;
  description: string;
  icon: Icon;
}

export interface SettingsArea {
  id: string;
  label: string;
  icon: Icon;
  sections: SettingsSectionInfo[];
}

export const settingsAreas: SettingsArea[] = [
  {
    id: 'general',
    label: 'General',
    icon: faSliders,
    sections: [
      {
        id: 'general-account',
        label: 'Account',
        description:
          'Sign in with Google to keep progress, statistics and settings across devices.',
        icon: faUser
      },
      {
        id: 'general-theme',
        label: 'Theme',
        description: 'Colors for the whole app, and how system light and dark mode are handled.',
        icon: faPalette
      },
      {
        id: 'general-custom-themes',
        label: 'Custom Themes',
        description: 'Create, edit, import and export themes.',
        icon: faSwatchbook
      }
    ]
  },
  {
    id: 'reader',
    label: 'Reader',
    icon: faBookOpen,
    sections: [
      {
        id: 'reader-text',
        label: 'Text Style',
        description: 'Fonts, sizes and paragraph spacing.',
        icon: faFont
      },
      {
        id: 'reader-writing',
        label: 'Writing',
        description: 'Writing direction, vertical text and furigana.',
        icon: faLanguage
      },
      {
        id: 'reader-layout',
        label: 'Page Layout',
        description: 'View mode, margins, columns and images.',
        icon: faTableColumns
      },
      {
        id: 'reader-progress',
        label: 'Progress',
        description: 'Counters in the footer and how bookmarks are placed.',
        icon: faBookmark
      },
      {
        id: 'reader-navigation',
        label: 'Navigation',
        description: 'Swiping, scrolling and tapping to turn pages.',
        icon: faHandPointer
      },
      {
        id: 'reader-session',
        label: 'Session',
        description: 'Screen lock and closing the reader.',
        icon: faDisplay
      }
    ]
  },
  {
    id: 'ai',
    label: 'AI',
    icon: faWandMagicSparkles,
    sections: [
      {
        id: 'ai-ask',
        label: 'Ask AI',
        description: 'OpenRouter key and model used when you select text and press Ask AI.',
        icon: faCommentDots
      },
      {
        id: 'ai-presets',
        label: 'Presets',
        description: 'Buttons in the Ask AI panel and their prompts.',
        icon: faListUl
      },
      {
        id: 'ai-read-aloud',
        label: 'Read Aloud',
        description: 'Text-to-speech with ElevenLabs.',
        icon: faHeadphones
      },
      {
        id: 'ai-recap',
        label: 'Story So Far & Lorebook',
        description: 'Spoiler-free recaps and the lorebook of what you have read.',
        icon: faClockRotateLeft
      }
    ]
  },
  {
    id: 'tracking',
    label: 'Tracking',
    icon: faChartLine,
    sections: [
      {
        id: 'tracking-statistics',
        label: 'Statistics',
        description: 'The reading tracker and when it pauses.',
        icon: faStopwatch
      },
      {
        id: 'tracking-day',
        label: 'Reading Day',
        description: 'When a day starts and how completions are counted.',
        icon: faSun
      },
      {
        id: 'tracking-merge',
        label: 'Sync & Merge',
        description: 'How statistics and goals from other devices are combined.',
        icon: faCodeMerge
      },
      {
        id: 'tracking-goals',
        label: 'Reading Goals',
        description: 'Daily, weekly and monthly targets.',
        icon: faBullseye
      }
    ]
  },
  {
    id: 'data',
    label: 'Data',
    icon: faDatabase,
    sections: [
      {
        id: 'data-storage',
        label: 'Local Storage',
        description: 'How this browser keeps books and data.',
        icon: faHardDrive
      },
      {
        id: 'data-import',
        label: 'Import',
        description: 'Fixes applied when importing EPUB files.',
        icon: faFileImport
      },
      {
        id: 'data-sync',
        label: 'Sync',
        description: 'Importing and exporting between storage sources.',
        icon: faRotate
      },
      {
        id: 'data-sources',
        label: 'Sources',
        description: 'Calibre, browser, cloud and folder storage.',
        icon: faServer
      }
    ]
  }
];

export const settingsSections = settingsAreas.flatMap((area, areaIndex) =>
  area.sections.map((section, index) => ({
    ...section,
    area: area.id,
    areaLabel: area.label,
    order: areaIndex * 100 + index
  }))
);

export function findSettingsSection(id: string) {
  return settingsSections.find((section) => section.id === id);
}

/** Old ?tab= links (the previous tab names) */
const legacySettingsTabs: Record<string, string> = {
  Reader: 'reader-text',
  Themes: 'general-custom-themes',
  Data: 'data-storage',
  Statistics: 'tracking-statistics',
  AI: 'ai-ask'
};

export function isFirstSectionOfArea(id: string) {
  return settingsAreas.some((area) => area.sections[0].id === id);
}

/** Section from #section-id, ?section=<area or section id> or a legacy ?tab=. */
export function sectionFromUrl(url: URL) {
  const section = url.searchParams.get('section') || '';
  const tab = url.searchParams.get('tab') || '';

  return (
    findSettingsSection(url.hash.slice(1)) ||
    findSettingsSection(section) ||
    settingsSections.find((candidate) => candidate.area === section) ||
    findSettingsSection(legacySettingsTabs[tab] || '')
  );
}

export interface SettingsView {
  area: string;
  query: string;
}

const contextKey = Symbol('settings-view');

export function setSettingsView(view: Writable<SettingsView>) {
  setContext(contextKey, view);
}

export function getSettingsView(): Writable<SettingsView> | undefined {
  return getContext(contextKey);
}
