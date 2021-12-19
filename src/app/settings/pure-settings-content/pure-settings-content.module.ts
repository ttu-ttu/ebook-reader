/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { ButtonToggleGroupModule } from 'src/app/components/button-toggle-group/button-toggle-group.module';
import { SettingsItemGroupModule } from '../settings-item-group/settings-item-group.module';
import { AvailableThemesToOptionsPipe } from './available-themes-to-options.pipe';
import { IsWritingModeVerticalPipe } from './is-writing-mode-vertical.pipe';
import { PureSettingsContentComponent } from './pure-settings-content.component';

@NgModule({
  declarations: [
    PureSettingsContentComponent,
    IsWritingModeVerticalPipe,
    AvailableThemesToOptionsPipe,
  ],
  imports: [
    CommonModule,
    ButtonToggleGroupModule,
    MatInputModule,
    SettingsItemGroupModule,
  ],
  exports: [PureSettingsContentComponent],
})
export class PureSettingsContentModule {}
