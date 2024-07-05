/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

export const heatmapDayElementSize = 15;

export const heatmapDayMargins = 20;

export const heatmapGridGapValue = 1;

export const heatmapMinValueColor = 'c6e48b';

export const heatmapMaxValueColor = '196127';

export const daysOfWeek = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

export const daysOfWeekShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const monthLabelList: HeatmapMonthLabel[] = [
  { monthLabel: 'Jan', heatmapColumn: '' },
  { monthLabel: 'Feb', heatmapColumn: '' },
  { monthLabel: 'Mar', heatmapColumn: '' },
  { monthLabel: 'Apr', heatmapColumn: '' },
  { monthLabel: 'May', heatmapColumn: '' },
  { monthLabel: 'Jun', heatmapColumn: '' },
  { monthLabel: 'Jul', heatmapColumn: '' },
  { monthLabel: 'Aug', heatmapColumn: '' },
  { monthLabel: 'Sep', heatmapColumn: '' },
  { monthLabel: 'Oct', heatmapColumn: '' },
  { monthLabel: 'Nov', heatmapColumn: '' },
  { monthLabel: 'Dec', heatmapColumn: '' }
];

export enum HeatmapType {
  STATISTICS = 'statistics',
  READING_GOALS = 'readingGoals'
}

export enum HeatmapDataAggregration {
  ALL_TIME = 'allTime',
  YEAR = 'year'
}

export enum HeatmapStreakType {
  NONE = 'none',
  LONGEST = 'longest',
  CURRENT = 'current',
  READING_GOALS_COMPLETED = 'readingGoalsCompleted'
}

export interface HeatmapMonthLabel {
  monthLabel: string;
  heatmapColumn: string;
}

export interface HeatmapStreak {
  startDate: string;
  endDate: string;
  duration: number;
}

export interface HeatmapColorRange {
  limit: number;
  color: string;
}

export interface HeatmapData {
  streaks: HeatmapStreak[];
  longestStreaks: HeatmapStreak[];
  currentStreak: HeatmapStreak;
}

export interface HeatmapGlobalDayData {
  readingTime: number;
  charactersRead: number;
  titles: Set<string>;
}

export interface HeatmapDayData {
  dateString: string;
  isCurrentYear: boolean;
  heatmapRow: number;
  heatmapColumn: number;
  color: string;
  dayDetails: string[];
}

export interface StatisticsHeatmapData extends HeatmapData {
  daysRead: string;
  colorRanges: HeatmapColorRange[];
}

export interface StatisticsHeatmapDayData
  extends HeatmapDayData,
    Omit<HeatmapGlobalDayData, 'charactersRead' | 'titles'> {}

export interface ReadingGoalHeatmapGlobalDayData extends HeatmapGlobalDayData {
  readingGoalStartDate: string;
  readingGoalEndDate: string;
  timeGoal: number;
  characterGoal: number;
  closedEarly: boolean;
  readingTimePercentage: number;
  normalizedReadingTimePercentage: number;
  charactersReadPercentage: number;
  normalizedCharactersReadPercentage: number;
  readingGoalCompletedPercentage: number;
  normalizedReadingGoalCompletedPercentage: number;
}

export interface ReadingGoalsHeatmapData extends HeatmapData {
  completedReadingGoals: string;
}
