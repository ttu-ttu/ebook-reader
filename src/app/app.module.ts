/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { NgModule } from '@angular/core';
import { ServiceWorkerModule } from '@angular/service-worker';
import { BrowserModule } from '@angular/platform-browser';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { VirtualScrollerModule } from 'ngx-virtual-scroller';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BookManagerComponent } from './book-manager/book-manager.component';
import { ReaderComponent } from './reader/reader.component';
import { SettingsDialogComponent } from './settings-dialog/settings-dialog.component';
import { environment } from '../environments/environment';

@NgModule({
  declarations: [
    AppComponent,
    BookManagerComponent,
    ReaderComponent,
    SettingsDialogComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FontAwesomeModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: environment.production,
      // Register the ServiceWorker as soon as the app is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    }),
    VirtualScrollerModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
