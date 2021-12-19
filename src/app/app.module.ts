/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';
import { WINDOW } from 'src/app/utils/dom-tokens';
import { environment } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { createBooksDb } from './database/books-db/factory';
import BOOKS_DB_PROMISE from './database/books-db/token';
import { ErrorDialogModule } from './log-report-dialog/log-report-dialog.module';
import { UpdateDialogModule } from './update-dialog/update-dialog.module';
import { GlobalErrorHandler } from './utils/global-error-handler.service';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: environment.production,
      // Register the ServiceWorker as soon as the app is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000',
    }),
    ErrorDialogModule,
    UpdateDialogModule,
  ],
  providers: [
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler,
    },
    {
      provide: BOOKS_DB_PROMISE,
      useFactory: createBooksDb,
    },
    {
      provide: WINDOW,
      useValue: window,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
