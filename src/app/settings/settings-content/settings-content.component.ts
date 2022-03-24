/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnInit,
} from '@angular/core';
import { Subject } from 'rxjs';
import { StoreService } from 'src/app/store.service';
import { WINDOW } from 'src/app/utils/dom-tokens';
import { availableThemes } from 'src/app/utils/theme-option';
import { defaultFuriganaStyle } from '../../models/furigana-style.model';
import { defaultWritingMode } from '../../models/writing-mode.model';

const availableThemeList = Object.entries(availableThemes).map(
  ([theme, option]) => ({
    theme,
    option,
  })
);

@Component({
  selector: 'app-settings-content',
  templateUrl: './settings-content.component.html',
  styleUrls: ['./settings-content.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsContentComponent implements OnInit {
  availableThemeList = availableThemeList;

  selectedTheme$ = this.store.theme$;

  fontSize$ = this.store.fontSize$;

  fontFamilyGroupOne$ = this.store.fontFamilyGroupOne$;

  fontFamilyGroupTwo$ = this.store.fontFamilyGroupTwo$;

  blurImage$ = this.store.hideSpoilerImage$;

  furiganaMode$ = this.store.hideFurigana$;

  furiganaStyle$ = this.store.furiganaStyle$;

  defaultFuriganaStyle = defaultFuriganaStyle;

  writingMode$ = this.store.writingMode$;

  secondDimensionMaxValue$ = this.store.secondDimensionMaxValue$;

  firstDimensionMargin$ = this.store.firstDimensionMargin$;

  autoPositionOnResize$ = this.store.autoPositionOnResize$;

  persistentStorage$ = new Subject<boolean>();

  defaultWritingMode = defaultWritingMode;

  private storage = this.window.navigator.storage;

  constructor(
    private store: StoreService,
    @Inject(WINDOW) private window: Window
  ) {}

  ngOnInit(): void {
    this.storage.persisted().then((x) => this.persistentStorage$.next(x));
  }

  onPersistentStorageChange(shouldPersist: boolean) {
    if (!shouldPersist) {
      return;
    }

    this.storage.persist().then((x) => this.persistentStorage$.next(x));
  }
}
