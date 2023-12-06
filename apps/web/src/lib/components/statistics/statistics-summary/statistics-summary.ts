/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import type { BookStatistic } from '$lib/components/statistics/statistics-types';

export interface StatisticsDataSourceChange {
  property: keyof BookStatistic;
  statisticsSummaryKey: StatisticsSummaryKey;
}

export enum StatisticsSummaryKey {
  DATE = 'dateKey',
  TITLE = 'title',
  READING_TIME = 'readingTime',
  CHARACTERS = 'characters',
  READING_SPEED = 'readingSpeed'
}
