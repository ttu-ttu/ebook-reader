/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { EbookDisplayManagerService } from '../ebook-display-manager.service';
import { ThemeManagerService } from '../theme-manager.service';
import { UiSettingsService } from '../ui-settings-service';


@Component({
  selector: 'app-settings-dialog',
  templateUrl: './settings-dialog.component.html',
  styleUrls: ['./settings-dialog.component.scss']
})
export class SettingsDialogComponent implements OnInit {

  @Output() closeClick = new EventEmitter<void>();

  faMinus = faMinus;
  faPlus = faPlus;

  constructor(
    public themeManagerService: ThemeManagerService,
    public ebookDisplayManagerService: EbookDisplayManagerService,
    public uiSettingsService: UiSettingsService,
    public cdr: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
  }

  onFontSizeUpdateClick(offset: number) {
    this.ebookDisplayManagerService.fontSize$.next(this.ebookDisplayManagerService.fontSize$.value + offset);
    this.cdr.markForCheck();
  }

  onThemeUpdateClick(i: number) {
    this.themeManagerService.setTheme(i);
    this.cdr.markForCheck();
  }

  onHideSpoilerImageClick() {
    this.ebookDisplayManagerService.hideSpoilerImage$.next(!this.ebookDisplayManagerService.hideSpoilerImage$.value);
    this.cdr.markForCheck();
  }

  onHideFuriganaClick() {
    this.ebookDisplayManagerService.hideFurigana$.next(!this.ebookDisplayManagerService.hideFurigana$.value);
    this.cdr.markForCheck();
  }

  onShowTooltipsClick() {
    this.uiSettingsService.showTooltips$.next(!this.uiSettingsService.showTooltips$.value);
    this.cdr.markForCheck();
  }
}
