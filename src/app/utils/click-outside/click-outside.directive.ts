/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { DOCUMENT } from '@angular/common';
import {
  Directive,
  EventEmitter,
  Output,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  Inject,
  NgZone,
} from '@angular/core';
import { fromEvent, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import outsideZone from '../rxjs/outside-zone';

@Directive({
  selector: '[appClickOutside]',
})
export class ClickOutsideDirective implements OnInit, OnDestroy {
  @Input()
  skippableMouseEvent?: MouseEvent;

  @Output()
  clickOutside = new EventEmitter<MouseEvent>();

  private destroy$ = new Subject<void>();

  constructor(
    private elRef: ElementRef<HTMLElement>,
    private zone: NgZone,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    fromEvent<MouseEvent>(this.document, 'click')
      .pipe(outsideZone(this.zone), takeUntil(this.destroy$))
      .subscribe((ev) => {
        if (
          ev !== this.skippableMouseEvent &&
          !this.elRef.nativeElement.contains(ev.target as Node)
        ) {
          this.zone.run(() => {
            this.clickOutside.emit(ev);
          });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
