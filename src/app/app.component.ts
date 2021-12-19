/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

/* eslint-disable rxjs-angular/prefer-takeuntil */
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnInit,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { NEVER, timer } from 'rxjs';
import {
  filter,
  map,
  pairwise,
  share,
  switchMap,
  take,
  takeUntil,
} from 'rxjs/operators';
import { StoreService } from 'src/app/store.service';
import { DatabaseService } from './database/books-db/database.service';
import { UpdateDialogComponent } from './update-dialog/update-dialog.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  isDbLoading$ = this.db.isReady$.pipe(map((x) => !x));

  constructor(
    private db: DatabaseService,
    private router: Router,
    private store: StoreService,
    dialog: MatDialog,
    updates: SwUpdate,
    @Inject(DOCUMENT) document: Document
  ) {
    updates.versionUpdates
      .pipe(
        filter((ev) => ev.type === 'VERSION_READY'),
        take(1),
        takeUntil(timer(60000 * 5))
      )
      .subscribe(() => {
        const dialogRef = dialog.open(UpdateDialogComponent, {
          panelClass: 'writing-horizontal-tb',
        });
        // eslint-disable-next-line rxjs/no-nested-subscribe
        dialogRef.afterClosed().subscribe((shouldReload) => {
          if (shouldReload) {
            updates.activateUpdate().then(() => document.location.reload());
          }
        });
      });
  }

  ngOnInit() {
    const url$ = this.router.events.pipe(
      filter((ev): ev is NavigationEnd => ev instanceof NavigationEnd),
      map((ev) => ev.url),
      share()
    );

    url$
      .pipe(
        take(1),
        switchMap((url) => {
          if (url === '/') {
            return this.db.lastItem$;
          }
          return NEVER;
        })
      )
      .subscribe((lastItem) => {
        if (lastItem) {
          this.router.navigate(['b', lastItem.dataId]);
        } else {
          this.router.navigate(['manage']);
        }
      });

    url$.pipe(pairwise()).subscribe(([previousUrl]) => {
      this.store.previousUrl$.next(previousUrl);
    });
  }
}
