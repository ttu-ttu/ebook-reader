<script lang="ts">
  import {
    faCancel,
    faChevronLeft,
    faChevronRight,
    faEdit,
    faRotate,
    faSave,
    faTrash
  } from '@fortawesome/free-solid-svg-icons';
  import { ReadingGoalFrequency } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
  import MessageDialog from '$lib/components/message-dialog.svelte';
  import SettingsReadingGoalsMerge from '$lib/components/settings/settings-reading-goals-merge.svelte';
  import SettingsSyncDialog from '$lib/components/settings/settings-sync-dialog.svelte';
  import {
    Button,
    IconButton,
    Input,
    List,
    ListItem,
    ListSection,
    Select,
    Tooltip
  } from '@custom-ereader/ui';
  import type {
    BooksDbReadingGoal,
    BooksDbStorageSource
  } from '$lib/data/database/books-db/versions/books-db';
  import { dialogManager, type SyncSelection } from '$lib/data/dialog-manager';
  import {
    getCurrentReadingGoal,
    getDateRangeLabel,
    type ReadingGoal,
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
      value: ReadingGoalFrequency.DAILY,
      id: ReadingGoalFrequency.DAILY,
      label: 'Daily (1 Day)'
    },
    {
      value: ReadingGoalFrequency.WEEKLY,
      id: ReadingGoalFrequency.WEEKLY,
      label: 'Weekly (7 Days)'
    },
    {
      value: ReadingGoalFrequency.MONTHLY,
      id: ReadingGoalFrequency.MONTHLY,
      label: 'Monthly (30 Days)'
    }
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

  async function deleteReadingGoals(readingGoalToDelete?: ReadingGoal, dateRangeLabel?: string) {
    let dialogMessage = '';

    if (readingGoalToDelete) {
      const isCurrentReadingGoal =
        $readingGoal$.goalStartDate &&
        $readingGoal$.goalStartDate === readingGoalToDelete.goalStartDate;
      const term =
        getDateKey($startDayHoursForTracker$) >= readingGoalToDelete.goalStartDate
          ? 'started'
          : 'starting';
      dialogMessage = `The${
        isCurrentReadingGoal ? ` current Reading Goal ${term} on` : ' archived Reading Goal for '
      } ${dateRangeLabel} will be deleted${isCurrentReadingGoal ? ' without archiving' : ''}`;
    } else if (readingGoals.length > 1) {
      dialogMessage = `All archived Reading Goals will be deleted${
        $readingGoal$.goalStartDate ? ' (including the current One)' : ''
      }`;
    } else {
      dialogMessage = $readingGoal$.goalStartDate
        ? 'Your current Reading Goal will be deleted without archiving'
        : 'Your archived Reading Goal will be deleted';
    }

    dialogMessage +=
      '\n\nExecute an one time Sync with an export behavior of "overwrite" and/or reading goals merge mode of "replace" to apply deletions to other devices';

    const wasCanceled = await new Promise((resolver) => {
      dialogManager.dialogs$.next([
        {
          component: ConfirmDialog,
          props: {
            dialogHeader: 'Data Deletion',
            dialogMessage,
            contentStyles: 'white-space: pre-line;',
            resolver
          },
          disableCloseOnClick: true
        }
      ]);
    });

    if (wasCanceled) {
      return;
    }

    dispatch('spinner', true);

    try {
      await database.deleteReadingGoal(readingGoalToDelete?.goalStartDate);
      await updateReadingGoalsData();
    } catch ({ message }: any) {
      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Error',
            message: `An Error occurred: ${message}`
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

<ListSection
  title="Reading Goals"
  description="Set daily, weekly, or monthly reading targets for time and character milestones"
>
  <div slot="action" class="flex items-center gap-2">
    {#if isInEditMode}
      <Button size="sm" variant="primary" disabled={saveDisabled} on:click={saveReadingGoal}>
        <Fa icon={faSave} class="mr-1.5" />
        <span>Save</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
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
        <Fa icon={faCancel} class="mr-1.5" />
        <span>Cancel</span>
      </Button>
    {:else}
      <Tooltip content="Sync reading goals with storage target">
        <Button size="sm" variant="secondary" on:click={syncReadingGoals}>
          <Fa icon={faRotate} class="mr-1.5" />
          <span>Sync</span>
        </Button>
      </Tooltip>
      <Button size="sm" variant="secondary" on:click={() => (isInEditMode = true)}>
        <Fa icon={faEdit} class="mr-1.5" />
        <span>Edit</span>
      </Button>
      {#if readingGoals.length}
        <Tooltip content="Reset / delete all reading goals">
          <IconButton
            size="sm"
            variant="ghost"
            label="Reset all goals"
            class="hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            on:click={() => deleteReadingGoals()}
          >
            <Fa icon={faTrash} />
          </IconButton>
        </Tooltip>
      {/if}
    {/if}
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
    <div>
      <label
        for="reading-goal-time"
        class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5"
      >
        Time Goal (Minutes)
      </label>
      <Input
        id="reading-goal-time"
        type="number"
        min={0}
        disabled={!isInEditMode}
        value={currentTimeGoalInMin}
        on:blur={(event) => handleReadingGoalChange(event, true)}
      >
        <span slot="suffix" class="text-xs text-zinc-500">min</span>
      </Input>
    </div>

    <div>
      <label
        for="reading-goal-chars"
        class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5"
      >
        Character Goal
      </label>
      <Input
        id="reading-goal-chars"
        type="number"
        min={0}
        disabled={!isInEditMode}
        value={currentCharacterGoal}
        on:blur={(event) => handleReadingGoalChange(event, false)}
      >
        <span slot="suffix" class="text-xs text-zinc-500">chars</span>
      </Input>
    </div>

    <div>
      <label
        for="reading-goal-frequency"
        class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5"
      >
        Goal Frequency
      </label>
      <Select
        id="reading-goal-frequency"
        disabled={!isInEditMode}
        options={readingGoalFrequencies}
        bind:value={currentReadingGoalFrequency}
      />
    </div>

    <div>
      <label
        for="reading-goal-start"
        class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5"
      >
        Start Date
      </label>
      <Input
        id="reading-goal-start"
        type="date"
        disabled={!isInEditMode}
        bind:value={currentReadingGoalStartDate}
      />
    </div>
  </div>

  <details class="mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-3 group">
    <summary
      class="text-xs font-medium text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200 select-none flex items-center justify-between"
    >
      <span>Reading Goal History ({pluralize(readingGoals.length, 'Item')})</span>
    </summary>
    {#if readingGoals.length}
      <div class="mt-3">
        <List variant="bordered" divided={true}>
          {#each historyReadingGoals as historyGoal (historyGoal.goalStartDate)}
            {@const dateRangeLabel = getDateRangeLabel(
              historyGoal.goalStartDate,
              historyGoal.goalEndDate
            )}
            <ListItem
              headline={dateRangeLabel}
              description={`${secondsToMinutes(historyGoal.timeGoal)} min • ${historyGoal.characterGoal} characters • ${historyGoal.goalFrequency}`}
            >
              <div slot="suffix">
                <Tooltip content="Delete Reading Goal">
                  <IconButton
                    size="sm"
                    variant="ghost"
                    label="Delete Reading Goal"
                    class="hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    on:click={() => deleteReadingGoals(historyGoal, dateRangeLabel)}
                  >
                    <Fa icon={faTrash} />
                  </IconButton>
                </Tooltip>
              </div>
            </ListItem>
          {/each}
        </List>
        <div class="mt-3 flex items-center justify-between px-1">
          <IconButton
            size="sm"
            variant="secondary"
            label="Previous Page"
            disabled={currentHistoryIndex === 0}
            on:click={() => (historyIndex -= 1)}
          >
            <Fa icon={faChevronLeft} />
          </IconButton>
          <span class="text-xs text-zinc-500">
            Page {historyIndex + 1} of {Math.max(
              1,
              Math.ceil(sortedReadingGoals.length / itemsPerPage)
            )}
          </span>
          <IconButton
            size="sm"
            variant="secondary"
            label="Next Page"
            disabled={!hasNextHistoryPage}
            on:click={() => (historyIndex += 1)}
          >
            <Fa icon={faChevronRight} />
          </IconButton>
        </div>
      </div>
    {:else}
      <div class="py-4 text-xs text-zinc-500 dark:text-zinc-400">
        You have no archived Reading Goals yet.
      </div>
    {/if}
  </details>
</ListSection>
