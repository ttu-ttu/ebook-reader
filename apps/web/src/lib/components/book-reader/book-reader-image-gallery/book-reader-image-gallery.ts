/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { Subject } from 'rxjs';
import { writableSubject } from '$lib/functions/svelte/store';

export enum ReaderImageGalleryAvailableKeybind {
  PREVIOUS_IMAGE = 'previousImage',
  NEXT_IMAGE = 'nextImage',
  CLOSE = 'close'
}

export interface ReaderImageGalleryPicture {
  url: string;
  unspoilered: boolean;
}

export type ReaderImageGalleryKeybindMap = Record<string, ReaderImageGalleryAvailableKeybind>;

export function setReaderImageGalleryPictureSpoiler() {}

export const readerImageGalleryPictures$ = writableSubject<ReaderImageGalleryPicture[]>([]);

export const toggleImageGalleryPictureSpoiler$ = new Subject<ReaderImageGalleryPicture>();

export const updateImageGalleryPictureSpoilers$ = new Subject<void>();
