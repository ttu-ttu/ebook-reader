/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { ButtonToggleGroupComponent } from './button-toggle-group.component';

@NgModule({
  declarations: [ButtonToggleGroupComponent],
  imports: [CommonModule, MatRippleModule],
  exports: [ButtonToggleGroupComponent],
})
export class ButtonToggleGroupModule {}
