/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */


import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PureSettingsContentModule } from '../pure-settings-content/pure-settings-content.module';
import { SettingsContentComponent } from './settings-content.component';

@NgModule({
  declarations: [SettingsContentComponent],
  imports: [CommonModule, PureSettingsContentModule],
  exports: [SettingsContentComponent],
})
export class SettingsContentModule {}
