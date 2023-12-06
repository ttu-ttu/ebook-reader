<script lang="ts">
  import {
    faCancel,
    faChevronLeft,
    faChevronRight,
    faEdit,
    faRotate,
    faSave
  } from '@fortawesome/free-solid-svg-icons';
  import { ReadingGoalFrequency } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import MessageDialog from '$lib/components/message-dialog.svelte';
  import SettingsReadingGoalsMerge from '$lib/components/settings/settings-reading-goals-merge.svelte';
  import SettingsSyncDialog from '$lib/components/settings/settings-sync-dialog.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import type {
    BooksDbReadingGoal,
    BooksDbStorageSource
  } from '$lib/data/database/books-db/versions/books-db';
  import { dialogManager, type SyncSelection } from '$lib/data/dialog-manager';
  import {
    getCurrentReadingGoal,
    getDateRangeLabel,
    type ReadingGoalSaveResult
  } from '$lib/data/reading-goal';
  import { getStorageHandler } from '$lib/data/storage/storage-handler-factory';
  import { StorageDataType, StorageKey } from '$lib/data/storage/storage-types';
  import {
    cacheStorageData$,
    database,
    isOnline$,
    readingGoal$,
    readingGoalsMergeMode$,
    replicationSaveBehavior$,
    startDayHoursForTracker$,
    statisticsMergeMode$
  } from '$lib/data/store';
  import { replicateData } from '$lib/functions/replication/replicator';
  import { isOnlineSourceAvailable, pluralize } from '$lib/functions/utils';
  import { getDateKey, secondsToMinutes } from '$lib/functions/statistic-util';
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import Fa from 'svelte-fa';

  export let storageSources: BooksDbStorageSource[] = [];

  const dispatch = createEventDispatcher<{
    spinner: boolean;
  }>();

  const readingGoalFrequencies = [
    {
      id: ReadingGoalFrequency.DAILY,
      label: 'Daily (1 Day)'
    },
    {
      id: ReadingGoalFrequency.WEEKLY,
      label: 'Weekly (7 Days)'
    },
    { id: ReadingGoalFrequency.MONTHLY, label: 'Monthly (30 Days)' }
  ];

  let currentTimeGoal = 0;
  let currentCharacterGoal = 0;
  let currentReadingGoalFrequency = ReadingGoalFrequency.DAILY;
  let currentReadingGoalStartDate = '';
  let isInEditMode = false;
  let readingGoals: BooksDbReadingGoal[] = [];
  let sortedReadingGoals: BooksDbReadingGoal[] = [];
  let historyIndex = 0;
  const itemsPerPage = 1;

  $: availableSources = storageSources.filter((source) =>
    isOnlineSourceAvailable($isOnline$, source.type)
  );

  $: saveDisabled = !!((currentTimeGoal || currentCharacterGoal) && !currentReadingGoalStartDate);

  $: currentTimeGoalInMin = secondsToMinutes(currentTimeGoal);

  $: currentHistoryIndex = Math.max(0, historyIndex * itemsPerPage);

  $: historyReadingGoals = sortedReadingGoals.slice(
    currentHistoryIndex,
    currentHistoryIndex + itemsPerPage
  );

  $: hasNextHistoryPage = sortedReadingGoals.length > currentHistoryIndex + itemsPerPage;

  $: if ($readingGoal$) {
    ({
      timeGoal: currentTimeGoal,
      characterGoal: currentCharacterGoal,
      goalFrequency: currentReadingGoalFrequency,
      goalStartDate: currentReadingGoalStartDate
    } = $readingGoal$);
  }

  onMount(init);

  function handleReadingGoalChange(event: Event, isTimeGoal: boolean) {
    const { value } = event.target as HTMLInputElement;

    const mod = isTimeGoal ? 60 : 1;
    const val = Math.floor((Number.parseFloat(value) || 0) * mod);

    if (isTimeGoal) {
      currentTimeGoal = val < 0 ? 0 : val;
    } else {
      currentCharacterGoal = val < 0 ? 0 : val;
    }
  }

  async function saveReadingGoal() {
    if (!currentTimeGoal && !currentCharacterGoal) {
      currentReadingGoalStartDate = '';
      currentReadingGoalFrequency = ReadingGoalFrequency.DAILY;
    }

    if (
      currentTimeGoal === $readingGoal$.timeGoal &&
      currentCharacterGoal === $readingGoal$.characterGoal &&
      currentReadingGoalFrequency === $readingGoal$.goalFrequency &&
      currentReadingGoalStartDate === $readingGoal$.goalStartDate
    ) {
      isInEditMode = false;
      return;
    }

    try {
      const todayKey = getDateKey($startDayHoursForTracker$);
      const initialExistingReadingGoals = await database.getReadingGoalsForDateWindow(
        currentReadingGoalStartDate < $readingGoal$.goalStartDate
          ? currentReadingGoalStartDate || $readingGoal$.goalStartDate
          : $readingGoal$.goalStartDate || currentReadingGoalStartDate
      );
      const existingReadingGoals = currentReadingGoalStartDate
        ? initialExistingReadingGoals.filter(
            (item) => item.goalStartDate !== $readingGoal$.goalStartDate
          )
        : [];
      const isFutureWithoutReadingGoalConflicts =
        $readingGoal$.goalStartDate &&
        todayKey < $readingGoal$.goalStartDate &&
        !existingReadingGoals.length;

      const newReadingGoal = {
        timeGoal: currentTimeGoal,
        characterGoal: currentCharacterGoal,
        goalFrequency: currentReadingGoalFrequency,
        goalStartDate: currentReadingGoalStartDate,
        lastGoalModified: Date.now()
      };
      let readingGoalsToDelete: string[] = [];
      let readingGoalsToInsert: BooksDbReadingGoal[] = [];
      let error = '';

      if (isFutureWithoutReadingGoalConflicts && currentReadingGoalStartDate) {
        readingGoalsToDelete.push($readingGoal$.goalStartDate);
        readingGoalsToInsert.push({ ...newReadingGoal, goalEndDate: '', goalOriginalEndDate: '' });
      } else if (isFutureWithoutReadingGoalConflicts) {
        readingGoalsToDelete.push($readingGoal$.goalStartDate);
      } else if (initialExistingReadingGoals.length) {
        ({ readingGoalsToDelete, readingGoalsToInsert, error } =
          await new Promise<ReadingGoalSaveResult>((resolver) => {
            dialogManager.dialogs$.next([
              {
                component: SettingsReadingGoalsMerge,
                props: { newReadingGoal, resolver },
                disableCloseOnClick: true
              }
            ]);
          }));
      } else {
        readingGoalsToInsert.push({ ...newReadingGoal, goalEndDate: '', goalOriginalEndDate: '' });
      }

      if (error) {
        throw new Error(error);
      }

      dispatch('spinner', true);

      await database.updateReadingGoals(readingGoalsToDelete, readingGoalsToInsert);
    } catch (error: any) {
      tick().then(() =>
        dialogManager.dialogs$.next([
          {
            component: MessageDialog,
            props: {
              title: 'Error',
              message: `Error updating Reading Goal(s): ${error.message}`
            }
          }
        ])
      );
    } finally {
      dispatch('spinner', false);
      isInEditMode = false;
      await updateReadingGoalsData().catch(() => {
        // no-op
      });
    }
  }

  async function syncReadingGoals() {
    const [source, target] = await new Promise<SyncSelection[]>((resolver) => {
      dialogManager.dialogs$.next([
        {
          component: SettingsSyncDialog,
          props: {
            settingsSyncHeader: 'Sync Reading Goals',
            storageSources: availableSources,
            resolver
          },
          disableCloseOnClick: true
        }
      ]);
    });

    if (!source || !target) {
      return;
    }

    dispatch('spinner', true);

    try {
      const error = await replicateData(
        getStorageHandler(
          window,
          source.type,
          source.id,
          target.type === StorageKey.BROWSER,
          $cacheStorageData$,
          $replicationSaveBehavior$,
          $statisticsMergeMode$,
          $readingGoalsMergeMode$
        ),
        getStorageHandler(
          window,
          target.type,
          target.id,
          target.type === StorageKey.BROWSER,
          $cacheStorageData$,
          $replicationSaveBehavior$,
          $statisticsMergeMode$,
          $readingGoalsMergeMode$
        ),
        false,
        [],
        [StorageDataType.READING_GOALS]
      );

      if (error) {
        throw new Error(error);
      }

      await updateReadingGoalsData();
    } catch ({ message }: any) {
      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Error',
            message: `Error syncing Reading Goals: ${message}`
          }
        }
      ]);
    } finally {
      dispatch('spinner', false);
    }
  }

  async function init() {
    try {
      dispatch('spinner', true);
      await updateReadingGoalsData();
    } catch (error: any) {
      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Error',
            message: `Error loading Reading Goals: ${error.message}`
          }
        }
      ]);
    } finally {
      dispatch('spinner', false);
    }
  }

  async function updateReadingGoalsData() {
    readingGoals = await database.getReadingGoals();

    sortedReadingGoals = [...readingGoals];
    sortedReadingGoals.sort((a, b) => (a.goalStartDate > b.goalStartDate ? -1 : 1));
    historyIndex = 0;

    $readingGoal$ = await getCurrentReadingGoal(readingGoals);
  }
</script>

<div class="mb-8 sm:col-span-2 lg:col-span-3">
  <div class="flex flex-grow">
    <h1 class="mb-2 text-xl font-medium w-full">
      <span class="capitalize">Reading Goals</span>
    </h1>
    {#if isInEditMode}
      <button class={`${buttonClasses} mr-4`} disabled={saveDisabled} on:click={saveReadingGoal}>
        <div
          class="flex items-center justify-center hover:opacity-50"
          class:cursor-not-allowed={saveDisabled}
        >
          <span class="mr-2">Save</span>
          <Fa icon={faSave} />
        </div>
      </button>
      <button
        class={buttonClasses}
        on:click={() => {
          ({
            timeGoal: currentTimeGoal,
            characterGoal: currentCharacterGoal,
            goalFrequency: currentReadingGoalFrequency,
            goalStartDate: currentReadingGoalStartDate
          } = $readingGoal$);

          isInEditMode = false;
        }}
      >
        <div class="flex items-center justify-center hover:opacity-50">
          <span class="mr-2">Cancel</span>
          <Fa icon={faCancel} />
        </div>
      </button>
    {:else}
      <button class={buttonClasses} on:click={syncReadingGoals}>
        <div class="flex items-center justify-center hover:opacity-50">
          <span class="mr-2">Sync</span>
          <Fa icon={faRotate} />
        </div>
      </button>
      <button class={buttonClasses} on:click={() => (isInEditMode = true)}>
        <div class="flex items-center justify-center hover:opacity-50">
          <span class="mr-2">Edit</span>
          <Fa icon={faEdit} />
        </div></button
      >
    {/if}
  </div>
  <hr class="border border-black" />
  <div class="grid grid-cols-1 gap-4 justify-between items-end mt-4 md:grid-cols-4">
    <div class="flex flex-col">
      Time Goal (Min)
      <input
        type="number"
        min="0"
        class:cursor-not-allowed={!isInEditMode}
        disabled={!isInEditMode}
        bind:value={currentTimeGoalInMin}
        on:blur={(event) => handleReadingGoalChange(event, true)}
      />
    </div>
    <div class="flex flex-col">
      Character Goal
      <input
        type="number"
        min="0"
        class:cursor-not-allowed={!isInEditMode}
        disabled={!isInEditMode}
        bind:value={currentCharacterGoal}
        on:blur={(event) => handleReadingGoalChange(event, false)}
      />
    </div>
    <div class="flex flex-col">
      Frequency
      <select
        class:cursor-not-allowed={!isInEditMode}
        disabled={!isInEditMode}
        bind:value={currentReadingGoalFrequency}
      >
        {#each readingGoalFrequencies as readingGoalFrequency (readingGoalFrequency.id)}
          <option value={readingGoalFrequency.id}>
            {readingGoalFrequency.label}
          </option>
        {/each}
      </select>
    </div>
    <div class="flex flex-col">
      Start Date
      <input
        type="date"
        class:cursor-not-allowed={!isInEditMode}
        disabled={!isInEditMode}
        bind:value={currentReadingGoalStartDate}
      />
    </div>
  </div>
  <details class="mt-6 cursor-pointer">
    <summary>Reading Goal History ({pluralize(readingGoals.length, 'Item')})</summary>
    {#if readingGoals.length}
      <div class="grid-cols-4 hidden sm:grid">
        {#each historyReadingGoals as historyGoal (historyGoal.goalStartDate)}
          <div>{getDateRangeLabel(historyGoal.goalStartDate, historyGoal.goalEndDate)}</div>
          <div>{secondsToMinutes(historyGoal.timeGoal)} min</div>
          <div>{historyGoal.characterGoal} characters</div>
          <div>{historyGoal.goalFrequency}</div>
        {/each}
      </div>
      <div class="sm:hidden">
        {#each historyReadingGoals as historyGoal (historyGoal.goalStartDate)}
          <div class="my-2">
            {getDateRangeLabel(historyGoal.goalStartDate, historyGoal.goalEndDate)} / {secondsToMinutes(
              historyGoal.timeGoal
            )} min / {historyGoal.characterGoal} characters / {historyGoal.goalFrequency}
          </div>
        {/each}
      </div>
      <div class="mt-3 flex justify-between">
        <button
          disabled={currentHistoryIndex === 0}
          class:opacity-50={currentHistoryIndex === 0}
          class:cursor-not-allowed={currentHistoryIndex === 0}
          on:click={() => (historyIndex -= 1)}
        >
          <Fa icon={faChevronLeft} />
        </button>
        <button
          disabled={!hasNextHistoryPage}
          class:opacity-50={!hasNextHistoryPage}
          class:cursor-not-allowed={!hasNextHistoryPage}
          on:click={() => (historyIndex += 1)}
        >
          <Fa icon={faChevronRight} />
        </button>
      </div>
    {:else}
      <div>You have no archived Reading Goals yet</div>
    {/if}
  </details>
</div>
