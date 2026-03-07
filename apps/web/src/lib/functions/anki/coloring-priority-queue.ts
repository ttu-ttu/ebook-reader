/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookContentColoring } from './color-book-content';

/**
 * Priority levels for element coloring
 * Lower number = higher priority
 */
export enum ProcessingPriority {
  VIEWPORT = 0, // Currently visible in viewport
  NEAR = 1, // Within 500px of viewport
  PREFETCH = 2 // Within 1000px of viewport
}

interface QueuedElement {
  element: Element;
  priority: ProcessingPriority;
  distanceFromViewport: number;
  addedAt: number;
  controller: AbortController;
}

/**
 * Priority queue for coloring elements based on viewport proximity
 * Ensures visible elements are colored first for better UX
 * Implements cross-element batching for maximum API efficiency
 */
export class ColoringPriorityQueue {
  private queue: QueuedElement[] = [];
  private processing = new Set<Element>();
  private maxConcurrent = 3;
  private coloringService: BookContentColoring;
  private batchSize = 1; // Number of elements to batch together
  private batchTimeout = 50; // Max ms to wait for batching
  private batchTimer: number | undefined;
  private pendingBatch: QueuedElement[] = [];

  constructor(coloringService: BookContentColoring, maxConcurrent = 3, batchSize = 5) {
    this.coloringService = coloringService;
    this.maxConcurrent = maxConcurrent;
    this.batchSize = batchSize;
  }

  /**
   * Add element to queue with priority
   * If element already exists, update priority if higher
   * @param element - DOM element to color
   * @param priority - Priority level
   * @param distance - Distance from viewport in pixels
   */
  enqueue(element: Element, priority: ProcessingPriority, distance: number): void {
    // Skip if already colored
    if (element.hasAttribute('data-anki-colored')) {
      return;
    }

    // Check if already in queue
    const existingIndex = this.queue.findIndex((item) => item.element === element);

    if (existingIndex !== -1) {
      const existing = this.queue[existingIndex];

      // Update if priority is higher (lower number)
      if (priority < existing.priority) {
        this.queue.splice(existingIndex, 1);
        existing.controller.abort();
      } else {
        // Keep existing priority
        return;
      }
    }

    // Add to queue
    this.queue.push({
      element,
      priority,
      distanceFromViewport: distance,
      addedAt: Date.now(),
      controller: new AbortController()
    });

    // Sort by priority and distance
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Within same priority, closer elements first
      return a.distanceFromViewport - b.distanceFromViewport;
    });

    this.processNext();
  }

  /**
   * Remove element from queue (e.g., scrolled far away)
   * @param element - DOM element to remove
   */
  dequeue(element: Element): void {
    const index = this.queue.findIndex((item) => item.element === element);

    if (index !== -1) {
      const item = this.queue[index];
      item.controller.abort();
      this.queue.splice(index, 1);
    }

    // Also check if currently processing
    if (this.processing.has(element)) {
      // Cannot abort mid-processing, but will be cleaned up when done
      this.processing.delete(element);
    }
  }

  /**
   * Clear all queued and processing elements
   */
  clear(): void {
    // Abort all queued items
    this.queue.forEach((item) => item.controller.abort());
    this.queue = [];
    this.processing.clear();
  }

  /**
   * Process next items in queue up to concurrency limit
   * Uses batching to process multiple elements together for API efficiency
   */
  private async processNext(): Promise<void> {
    // Check if we can start a new batch
    if (this.processing.size >= this.maxConcurrent) {
      return;
    }

    // Collect elements for batching
    const batch: QueuedElement[] = [];
    const batchLimit = Math.min(this.batchSize, this.queue.length);

    for (let i = 0; i < batchLimit; i++) {
      const item = this.queue.shift();
      if (!item) break;

      // Skip if already colored
      if (item.element.hasAttribute('data-anki-colored')) {
        continue;
      }

      // Skip if aborted
      if (item.controller.signal.aborted) {
        continue;
      }

      batch.push(item);
      this.processing.add(item.element);
    }

    if (batch.length === 0) {
      return;
    }

    // Process batch (don't await - run concurrently)
    this._processBatch(batch)
      .finally(() => {
        // Clean up all elements in batch
        batch.forEach((item) => this.processing.delete(item.element));
        this.processNext(); // Process next batch
      })
      .catch(() => {
        // Error already logged
      });

    // If there are more items and we have concurrency left, process more
    if (this.queue.length > 0 && this.processing.size < this.maxConcurrent) {
      this.processNext();
    }
  }

  /**
   * Process a batch of elements together for maximum API efficiency
   * Uses colorizeElementsBatch to share token queries across all elements
   * @param batch - Array of queued elements to process together
   */
  private async _processBatch(batch: QueuedElement[]): Promise<void> {
    try {
      // Check if all items are aborted
      const validItems = batch.filter((item) => !item.controller.signal.aborted);
      if (validItems.length === 0) {
        return;
      }

      // Extract elements from batch items
      const elements = validItems.map((item) => item.element);

      // Color all elements together with shared token batching
      // This makes ONE API call for all tokens from all elements
      await this.coloringService.colorizeElementsBatch(elements);
    } catch {
      // Error already handled in colorizeElementsBatch
    }
  }

  /**
   * Process a single element (legacy method, kept for compatibility)
   * @param item - Queued element to process
   */
  private async _processElement(item: QueuedElement): Promise<void> {
    try {
      // Check if aborted before starting
      if (item.controller.signal.aborted) {
        return;
      }

      // Colorize element using the coloring service
      await this.coloringService.colorizeElement(item.element);
    } catch {
      // Error already handled in colorizeElement
      // Just prevent unhandled promise rejection
    }
  }

  /**
   * Get current queue status for debugging
   * @returns Queue statistics
   */
  getStats(): {
    queued: number;
    processing: number;
    queuedByPriority: Record<ProcessingPriority, number>;
  } {
    const queuedByPriority = {
      [ProcessingPriority.VIEWPORT]: 0,
      [ProcessingPriority.NEAR]: 0,
      [ProcessingPriority.PREFETCH]: 0
    };

    this.queue.forEach((item) => {
      queuedByPriority[item.priority]++;
    });

    return {
      queued: this.queue.length,
      processing: this.processing.size,
      queuedByPriority
    };
  }
}
