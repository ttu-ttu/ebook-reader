/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
  name: 'imageResolver',
})
export class ImageResolverPipe implements PipeTransform, OnDestroy {
  objectUrl?: string;

  constructor(private domSanitizer: DomSanitizer) {}

  ngOnDestroy() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
  }

  transform(value: string | Blob) {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = undefined;
    }
    if (typeof value !== 'string') {
      this.objectUrl = URL.createObjectURL(value);
      return this.domSanitizer.bypassSecurityTrustUrl(this.objectUrl);
    }
    return value;
  }
}
