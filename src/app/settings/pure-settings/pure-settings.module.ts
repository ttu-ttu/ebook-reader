/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SettingsContentModule } from '../settings-content/settings-content.module';
import { SettingsHeaderModule } from '../settings-header/settings-header.module';
import { PureSettingsComponent } from './pure-settings.component';

@NgModule({
  declarations: [PureSettingsComponent],
  imports: [CommonModule, SettingsHeaderModule, SettingsContentModule],
  exports: [PureSettingsComponent],
})
export class PureSettingsModule {}
