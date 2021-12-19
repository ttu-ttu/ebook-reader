/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'b/:identifier',
    loadChildren: () =>
      import('./book-reader/book-reader.module').then(
        (m) => m.BookReaderModule
      ),
  },
  {
    path: 'manage',
    loadChildren: () =>
      import('./book-manager/book-manager.module').then(
        (m) => m.BookManagerModule
      ),
  },
  {
    path: 'settings',
    loadChildren: () =>
      import('./settings/settings.module').then((m) => m.SettingsModule),
  },
  {
    path: '**',
    redirectTo: '/manage',
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      initialNavigation: 'enabled',
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
