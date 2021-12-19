/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import {
  defaultFuriganaStyle,
  FuriganaStyle,
} from 'src/app/models/furigana-style.model';
import { ToggleOption } from 'src/app/models/toggle-option.model';
import { WritingMode } from 'src/app/models/writing-mode.model';
import { defaultWritingMode } from '../../models/writing-mode.model';
import { AvailableTheme } from './available-theme.model';

@Component({
  selector: 'app-pure-settings-content',
  templateUrl: './pure-settings-content.component.html',
  styleUrls: ['./pure-settings-content.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PureSettingsContentComponent {
  @Input()
  availableThemes: AvailableTheme[] = [];

  @Input()
  selectedTheme = '';

  @Output()
  selectedThemeChange = new EventEmitter<string>();

  @Input()
  fontSize = 16;

  @Output()
  fontSizeChange = new EventEmitter<number>();

  @Input()
  fontFamilyGroupOne = '';

  @Output()
  fontFamilyGroupOneChange = new EventEmitter<string>();

  @Input()
  fontFamilyGroupTwo = '';

  @Output()
  fontFamilyGroupTwoChange = new EventEmitter<string>();

  @Input()
  blurImage = false;

  @Output()
  blurImageChange = new EventEmitter<boolean>();

  @Input()
  hideFurigana = false;

  @Output()
  hideFuriganaChange = new EventEmitter<boolean>();

  @Input()
  furiganaStyle = defaultFuriganaStyle;

  @Output()
  furiganaStyleChange = new EventEmitter<FuriganaStyle>();

  @Input()
  writingMode: WritingMode = defaultWritingMode;

  @Output()
  writingModeChange = new EventEmitter<WritingMode>();

  @Input()
  secondDimensionMaxValue = 0;

  @Output()
  secondDimensionMaxValueChange = new EventEmitter<number>();

  @Input()
  firstDimensionMargin = 0;

  @Output()
  firstDimensionMarginChange = new EventEmitter<number>();

  @Input()
  autoPositionOnResize = false;

  @Output()
  autoPositionOnResizeChange = new EventEmitter<boolean>();

  optionsForToggle: ToggleOption<boolean>[] = [
    {
      id: false,
      text: 'Off',
    },
    {
      id: true,
      text: 'On',
    },
  ];

  optionsForFuriganaStyle: ToggleOption<FuriganaStyle>[] = [
    {
      id: FuriganaStyle.Partial,
      text: 'Partial',
    },
    {
      id: FuriganaStyle.Full,
      text: 'Full',
    },
  ];

  optionsForWritingMode: ToggleOption<WritingMode>[] = [
    {
      id: 'horizontal-tb',
      text: 'Horizontal',
    },
    {
      id: 'vertical-rl',
      text: 'Vertical',
    },
  ];
}
