/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 *   All rights reserved.
 *
 *   This source code is licensed under the BSD-style license found in the
 *   LICENSE file in the root directory of this source tree.
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReaderComponent } from './reader/reader.component';

const routes: Routes = [
  {
    path: 'b/:identifier',
    component: ReaderComponent,
  },
  {
    path: '**',
    redirectTo: '',
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    initialNavigation: 'enabled',
  })],
  exports: [RouterModule],
})
export class AppRoutingModule {
}
