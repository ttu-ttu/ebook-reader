/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import { Subject, BehaviorSubject } from 'rxjs';
import { localStorage } from './local-storage';

export class PresetStorage {
  private _preset: string;

  private bookPresets$: BehaviorSubject<Record<string, string>>; // idk how better to avoid cyclic dependency

  public presetChanged: Subject<undefined>;

  /* eslint-disable-next-line @typescript-eslint/default-param-last */
  constructor(preset: string = 'Global', bookPresets$: BehaviorSubject<Record<string, string>>) {
    this._preset = preset;
    this.bookPresets$ = bookPresets$;
    this.presetChanged = new Subject<undefined>();
  }

  setItem(key: string, value: string) {
    const allPresetSettingsValue = localStorage.getItem('presetSettings') ?? '{}';
    let allPresetSettingsObj;
    let presetSettings;

    try {
      allPresetSettingsObj = JSON.parse(allPresetSettingsValue);
      presetSettings = allPresetSettingsObj[this._preset] ?? {};
    } catch (error) {
      allPresetSettingsObj = {};
      presetSettings = {};
    }

    presetSettings[key] = value;
    allPresetSettingsObj[this._preset] = presetSettings;
    localStorage.setItem('presetSettings', JSON.stringify(allPresetSettingsObj));
  }

  getItem(key: string) {
    const allPresetSettingsValue = localStorage.getItem('presetSettings');

    if (allPresetSettingsValue) {
      try {
        const allPresetSettingsObj = JSON.parse(allPresetSettingsValue);
        const presetSettings = allPresetSettingsObj[this._preset];
        return presetSettings[key];
      } catch (error) {
        return undefined;
      }
    }

    return undefined;
  }

  /* eslint-disable no-empty */
  removeItem(key: string) {
    const allPresetSettingsValue = localStorage.getItem('presetSettings');

    if (allPresetSettingsValue) {
      try {
        const allPresetSettingsObj = JSON.parse(allPresetSettingsValue);
        const presetSettings = allPresetSettingsObj[this._preset];
        delete presetSettings[key];
        localStorage.setItem('presetSettings', JSON.stringify(allPresetSettingsObj));
      } catch (error) {}
    }
  }

  clear() {
    const allPresetSettingsValue = localStorage.getItem('presetSettings');

    if (allPresetSettingsValue) {
      try {
        const allPresetSettingsObj = JSON.parse(allPresetSettingsValue);
        allPresetSettingsObj[this._preset] = {};
        localStorage.setItem('presetSettings', JSON.stringify(allPresetSettingsObj));
      } catch (error) {}
    }
  }

  // Helper functions
  static getPresetList() {
    const allPresetSettingsValue = localStorage.getItem('presetSettings');

    if (allPresetSettingsValue) {
      try {
        const allPresetSettingsObj = JSON.parse(allPresetSettingsValue);
        return Object.keys(allPresetSettingsObj);
      } catch (error) {
        return [];
      }
    }

    return [];
  }

  setPreset(presetName: string) {
    this._preset = presetName;
    this.presetChanged.next(undefined);
  }

  createNew(newPresetName: string) {
    const allPresetSettingsValue = localStorage.getItem('presetSettings');

    if (allPresetSettingsValue) {
      try {
        const allPresetSettingsObj = JSON.parse(allPresetSettingsValue);
        const refPresetSettings = allPresetSettingsObj[this._preset];
        allPresetSettingsObj[newPresetName] = structuredClone(refPresetSettings);
        localStorage.setItem('presetSettings', JSON.stringify(allPresetSettingsObj));
      } catch (error) {}
    }
  }

  rename(newPresetName: string) {
    const allPresetSettingsValue = localStorage.getItem('presetSettings');

    if (allPresetSettingsValue) {
      try {
        const allPresetSettingsObj = JSON.parse(allPresetSettingsValue);
        allPresetSettingsObj[newPresetName] = allPresetSettingsObj[this._preset];
        delete allPresetSettingsObj[this._preset];
        localStorage.setItem('presetSettings', JSON.stringify(allPresetSettingsObj));
      } catch (error) {}
    }

    const bookPresets = this.bookPresets$.getValue();
    const bookPresetKeys = Object.keys(bookPresets);

    for (let index = 0; index < bookPresetKeys.length; index += 1) {
      const key = bookPresetKeys[index];
      const value = bookPresets[key];
      if (value === this._preset) {
        bookPresets[key] = newPresetName;
      }
    }

    this.bookPresets$.next(bookPresets);

    this._preset = newPresetName;
  }

  delete() {
    const allPresetSettingsValue = localStorage.getItem('presetSettings');

    if (allPresetSettingsValue) {
      try {
        const allPresetSettingsObj = JSON.parse(allPresetSettingsValue);
        delete allPresetSettingsObj[this._preset];
        localStorage.setItem('presetSettings', JSON.stringify(allPresetSettingsObj));
      } catch (error) {}
    }

    const bookPresets = this.bookPresets$.getValue();
    const bookPresetKeys = Object.keys(bookPresets);

    for (let index = 0; index < bookPresetKeys.length; index += 1) {
      const key = bookPresetKeys[index];
      const value = bookPresets[key];
      if (value === this._preset) {
        bookPresets[key] = 'Global';
      }
    }

    this.bookPresets$.next(bookPresets);
  }
}
