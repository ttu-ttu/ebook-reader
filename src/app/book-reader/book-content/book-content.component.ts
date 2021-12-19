/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ContentRect } from 'resize-observer/lib/ContentRect';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import ContentLoadEvent from 'src/app/models/content-load-event.model';
import { defaultFuriganaStyle } from 'src/app/models/furigana-style.model';
import { StoreService } from 'src/app/store.service';
import { availableThemes } from 'src/app/utils/theme-option';

@Component({
  selector: 'app-book-content',
  templateUrl: './book-content.component.html',
  styleUrls: ['./book-content.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookContentComponent {
  @Input()
  htmlContent!: string;

  @Output()
  contentResize = new EventEmitter<ContentRect>();

  @Output()
  contentLoad = new EventEmitter<ContentLoadEvent>();

  @Output()
  contentReady = new EventEmitter<void>();

  themeOption$ = this.store.theme$.pipe(map((theme) => availableThemes[theme]));

  fontColor$ = this.themeOption$.pipe(map((o) => o.fontColor));

  backgroundColor$ = this.themeOption$.pipe(map((o) => o.backgroundColor));

  hintFuriganaFontColor$ = this.themeOption$.pipe(
    map((o) => o.hintFuriganaFontColor)
  );

  hintFuriganaShadowColor$ = this.themeOption$.pipe(
    map((o) => o.hintFuriganaShadowColor)
  );

  verticalMode$ = this.store.verticalMode$;

  fontSize$ = this.store.fontSize$;

  fontFamilyGroupOne$ = this.store.fontFamilyGroupOne$;

  fontFamilyGroupTwo$ = this.store.fontFamilyGroupTwo$;

  hideSpoilerImage$ = this.store.hideSpoilerImage$;

  hideFurigana$ = this.store.hideFurigana$;

  furiganaStyle$ = this.store.furiganaStyle$;

  secondDimensionMaxValue$ = this.store.secondDimensionMaxValue$;

  firstDimensionMargin$ = this.store.firstDimensionMargin$;

  defaultFuriganaStyle = defaultFuriganaStyle;

  isImageLoading$ = new BehaviorSubject(false);

  constructor(private store: StoreService) {}
}
