/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

export enum StatisticsTabAvailableKeybind {
  RANGE_TEMPLATE_TOGGLE = 'templateRangeToggle',
  AGGREGRATION_TOGGLE = 'aggregationToggle'
}

export type StatisticsTabKeybindMap = Record<string, StatisticsTabAvailableKeybind>;
