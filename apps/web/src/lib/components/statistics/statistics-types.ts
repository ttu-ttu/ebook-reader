/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import type { BooksDbStatistic } from '$lib/data/database/books-db/versions/books-db';
import { Subject } from 'rxjs';
import { writableSubject } from '$lib/functions/svelte/store';

export interface StatisticsDateChange {
  dateString: string;
  isStartDate: boolean;
}

export interface StatisticsDataSource {
  key: keyof BookStatistic;
  label: string;
}

export interface StatisticsTitleFilterItem {
  title: string;
  isSelected: boolean;
}

export interface BookStatistic extends BooksDbStatistic {
  id: string;
  averageReadingTime: number;
  averageWeightedReadingTime: number;
  averageCharactersRead: number;
  averageWeightedCharactersRead: number;
  averageReadingSpeed: number;
  averageWeightedReadingSpeed: number;
}

export enum StatisticsTab {
  OVERVIEW = 'Overview',
  SUMMARY = 'Summary'
}

export enum StatisticsRangeTemplate {
  TODAY = 'Today',
  WEEK = 'This Week',
  MONTH = 'This Month',
  YEAR = 'This Year',
  CUSTOM = 'Custom'
}

export enum StatisticsReadingDataAggregationMode {
  NONE = 'None',
  DATE = 'Date',
  TITLE = 'Title'
}

export const statisticsRangeTemplates = [
  StatisticsRangeTemplate.TODAY,
  StatisticsRangeTemplate.WEEK,
  StatisticsRangeTemplate.MONTH,
  StatisticsRangeTemplate.YEAR,
  StatisticsRangeTemplate.CUSTOM
];

export const readingTimeDataSources: StatisticsDataSource[] = [
  { key: 'readingTime', label: 'Total Time' },
  { key: 'averageReadingTime', label: 'Average Time' },
  { key: 'averageWeightedReadingTime', label: 'Weighted Time' }
];

export const charactersDataSources: StatisticsDataSource[] = [
  { key: 'charactersRead', label: 'Characters' },
  { key: 'averageCharactersRead', label: 'Average Characters' },
  { key: 'averageWeightedCharactersRead', label: 'Weighted Characters' }
];

export const readingSpeedDataSources: StatisticsDataSource[] = [
  { key: 'lastReadingSpeed', label: 'Speed' },
  { key: 'minReadingSpeed', label: 'Min Speed' },
  { key: 'altMinReadingSpeed', label: 'Alt Min Speed' },
  { key: 'maxReadingSpeed', label: 'Max Speed' }
];

export const dateDataSources: StatisticsDataSource[] = [{ key: 'dateKey', label: 'Date' }];

export const titleDataSources: StatisticsDataSource[] = [{ key: 'title', label: 'Title' }];

export const copyStatisticsData$ = new Subject<keyof BookStatistic>();

export const exportStatisticsData$ = new Subject<boolean>();

export const deleteStatisticsData$ = new Subject<boolean>();

export const setStatisticsDatesToAllTime$ = new Subject<void>();

export const statisticsActionInProgress$ = writableSubject<boolean>(false);

export const statisticsTitleFilterEnabled$ = writableSubject<boolean>(false);

export const statisticsTitleFilterIsOpen$ = writableSubject<boolean>(false);

export const preFilteredTitlesForStatistics$ = writableSubject<Set<string>>(new Set());

export const statisticsDataAggregrationModes = [
  StatisticsReadingDataAggregationMode.NONE,
  StatisticsReadingDataAggregationMode.DATE,
  StatisticsReadingDataAggregationMode.TITLE
];
