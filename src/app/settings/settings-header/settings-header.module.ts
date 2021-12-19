/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { SettingsHeaderComponent } from './settings-header.component';

@NgModule({
  declarations: [SettingsHeaderComponent],
  imports: [CommonModule, RouterModule, FontAwesomeModule],
  exports: [SettingsHeaderComponent],
})
export class SettingsHeaderModule {}
