<script lang="ts">
  import { faSpinner } from '@fortawesome/free-solid-svg-icons';
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import type { BooksDbReadingGoal } from '$lib/data/database/books-db/versions/books-db';
  import {
    getDateRangeLabel,
    getReadingGoalWindow,
    type ReadingGoal,
    type ReadingGoalArchivalOption,
    type ReadingGoalSaveResult
  } from '$lib/data/reading-goal';
  import { database, readingGoal$, startDayHoursForTracker$ } from '$lib/data/store';
  import {
    advanceDateDays,
    getDateKey,
    getPreviousDayKey,
    secondsToMinutes
  } from '$lib/functions/statistic-util';
  import { pluralize } from '$lib/functions/utils';
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import Fa from 'svelte-fa';

  export let newReadingGoal: ReadingGoal;
  export let resolver: (arg0: ReadingGoalSaveResult) => void;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let showSpinner = true;
  let newStartDate = newReadingGoal.goalStartDate;
  let archiveReadingGoal = false;
  let archiveDateEditable = false;
  let archivalOptions: ReadingGoalArchivalOption[] = [];
  let selectedArchiveOption = '';
  let archivalMaxDate: string;
  let archivalStartDate = '';
  let archivalEndDate = '';
  let archivalOriginalEndDate = '';
  let error = '';
  let existingReadingGoals: BooksDbReadingGoal[] = [];
  let readingGoalsToReplace: BooksDbReadingGoal[] = [];

  $: selectedArchiveOptionObject = archivalOptions.find(
    (opt) => opt.label === selectedArchiveOption
  );

  $: readingGoalsToReplace = existingReadingGoals.filter(
    (readingGoal) => readingGoal.goalStartDate !== $readingGoal$.goalStartDate
  );

  $: readingGoalToReplaceMessage = readingGoalsToReplace.length
    ? `${pluralize(readingGoalsToReplace.length, 'Item')} will be replaced`
    : '';

  $: if (selectedArchiveOptionObject) {
    ({ archivalStartDate, archivalEndDate } = selectedArchiveOptionObject);
    archiveDateEditable = selectedArchiveOptionObject.editable;
    updateNextReadingGoalStartDate();
  }

  $: if (newReadingGoal.goalStartDate) {
    if (!archiveReadingGoal) {
      newStartDate = newReadingGoal.goalStartDate;
      archivalStartDate = $readingGoal$.goalStartDate;
    } else {
      updateNextReadingGoalStartDate();
    }
  }

  onMount(init);

  async function checkDates() {
    try {
      showSpinner = true;

      if (!archivalStartDate || !archivalEndDate) {
        archivalStartDate = $readingGoal$.goalStartDate;
        archivalEndDate = archivalMaxDate;
      } else if (archivalEndDate < archivalStartDate) {
        const oldStartDate = archivalStartDate;
        const oldEndStartDate = archivalEndDate;

        archivalStartDate = oldEndStartDate;
        archivalEndDate = oldStartDate;
      }

      await updateExistingReadingGoals();

      showSpinner = false;
    } catch ({ message }: any) {
      error = `Failed to refresh Reading Goals (${message})`;
      closeDialog();
    }
  }

  async function closeDialog(wasCanceled = false) {
    const exitEarly = wasCanceled || error;

    const resultObject: ReadingGoalSaveResult = {
      readingGoalsToDelete: [],
      readingGoalsToInsert: [],
      error
    };

    if (exitEarly) {
      resolver(resultObject);
      dispatch('close');
    }

    await tick();

    const goalsToDelete = new Set<string>();

    readingGoalsToReplace.forEach((goal) => goalsToDelete.add(goal.goalStartDate));

    if ($readingGoal$.goalStartDate) {
      goalsToDelete.add($readingGoal$.goalStartDate);
    }

    if (archiveReadingGoal) {
      resultObject.readingGoalsToInsert.push({
        ...$readingGoal$,
        ...{
          goalStartDate: archivalStartDate,
          goalEndDate: archivalEndDate,
          goalOriginalEndDate: archivalOriginalEndDate
        }
      });
    }

    resultObject.readingGoalsToDelete = [...goalsToDelete];
    resultObject.readingGoalsToInsert = [
      ...resultObject.readingGoalsToInsert,
      ...(newReadingGoal.goalStartDate
        ? [
            {
              ...newReadingGoal,
              ...{ goalStartDate: newStartDate, goalEndDate: '', goalOriginalEndDate: '' }
            }
          ]
        : [])
    ];

    resolver(resultObject);
    dispatch('close');
  }

  function updateNextReadingGoalStartDate() {
    if (!newReadingGoal.goalStartDate) {
      return;
    }

    if (!archiveReadingGoal || newReadingGoal.goalStartDate > archivalEndDate) {
      newStartDate = newReadingGoal.goalStartDate;
    } else {
      ({ dateString: newStartDate } = advanceDateDays(new Date(archivalEndDate)));
    }
  }

  async function init() {
    try {
      const todayKey = getDateKey($startDayHoursForTracker$);

      if ($readingGoal$.goalStartDate && todayKey >= $readingGoal$.goalStartDate) {
        const yesterDayKey = getPreviousDayKey($startDayHoursForTracker$);
        const [readingGoalStart, readingGoalEnd] = getReadingGoalWindow(
          todayKey,
          $startDayHoursForTracker$,
          $readingGoal$
        );
        const previousReadingGoalEnd = getPreviousDayKey(
          $startDayHoursForTracker$,
          new Date(readingGoalStart)
        );

        archivalMaxDate = readingGoalEnd;

        archivalOptions.push({
          label: 'Custom',
          archivalStartDate: $readingGoal$.goalStartDate,
          archivalEndDate: readingGoalEnd,
          editable: true
        });

        if (
          previousReadingGoalEnd > $readingGoal$.goalStartDate &&
          yesterDayKey !== previousReadingGoalEnd &&
          todayKey !== previousReadingGoalEnd
        ) {
          archivalOptions.push({
            label: 'Close previous nearest End',
            archivalStartDate: $readingGoal$.goalStartDate,
            archivalEndDate: previousReadingGoalEnd,
            editable: false
          });
        }

        if (yesterDayKey >= $readingGoal$.goalStartDate) {
          archivalOptions.push({
            label: 'Close Yesterday',
            archivalStartDate: $readingGoal$.goalStartDate,
            archivalEndDate: yesterDayKey,
            editable: false
          });
        }

        if (todayKey >= $readingGoal$.goalStartDate) {
          archivalOptions.push({
            label: 'Close Today',
            archivalStartDate: $readingGoal$.goalStartDate,
            archivalEndDate: todayKey,
            editable: false
          });
        }

        if (readingGoalEnd !== todayKey) {
          archivalOptions.push({
            label: 'Close nearest End',
            archivalStartDate: $readingGoal$.goalStartDate,
            archivalEndDate: readingGoalEnd,
            editable: false
          });
        }

        archiveReadingGoal = true;
        selectedArchiveOption = archivalOptions[0].label;
        archivalOptions = [...archivalOptions];
        archivalOriginalEndDate = readingGoalEnd;
      }

      await updateExistingReadingGoals();

      showSpinner = false;
    } catch ({ message }: any) {
      error = `Failed to set Context (${message})`;
      closeDialog();
    }
  }

  async function updateExistingReadingGoals() {
    updateNextReadingGoalStartDate();

    await tick();

    if (archiveReadingGoal) {
      existingReadingGoals = await database.getReadingGoalsForDateWindow(
        archivalStartDate,
        newStartDate,
        archivalEndDate
      );
    } else if (newReadingGoal.goalStartDate) {
      existingReadingGoals = await database.getReadingGoalsForDateWindow(
        newReadingGoal.goalStartDate,
        newStartDate
      );
    } else {
      existingReadingGoals = [];
    }
  }
</script>

{#if showSpinner}
  <div class="tap-highlight-transparent absolute inset-0 bg-black/[.2]" />
  <div class="fixed inset-0 flex h-full w-full items-center justify-center text-7xl">
    <Fa icon={faSpinner} spin />
  </div>
{/if}
<DialogTemplate>
  <svelte:fragment slot="header">Save Reading Goal</svelte:fragment>
  <svelte:fragment slot="content">
    {#if newReadingGoal.goalStartDate}
      <div>
        <span>New Reading Goal starts from</span>
        <input
          disabled
          class="mb-4 sm:ml-1"
          type="date"
          min={newReadingGoal.goalStartDate}
          bind:value={newStartDate}
        />
      </div>
    {/if}
    {#if archivalOptions.length}
      <input type="checkbox" bind:checked={archiveReadingGoal} on:change={checkDates} />
      <span class:opacity-50={!archiveReadingGoal}>
        <span class="mr-2">Archive Reading Goal from</span>
        <input
          class="w-full mt-2 sm:mt-0 md:w-[initial]"
          type="date"
          disabled={!archiveReadingGoal || !archiveDateEditable}
          bind:value={archivalStartDate}
          on:change={checkDates}
        />
        <span class="mx-2">-</span>
        <input
          class="w-full md:w-[initial]"
          type="date"
          disabled={!archiveReadingGoal || !archiveDateEditable}
          bind:value={archivalEndDate}
          on:change={checkDates}
        />
      </span>
      <div
        class="flex flex-col justify-between mt-2 md:flex-row"
        class:md:flex-col={archivalOptions?.length > 3}
      >
        {#each archivalOptions as archivalOption (archivalOption.label)}
          <div class="flex items-center">
            <input
              type="radio"
              name="action"
              class="my-2 mr-1"
              class:cursor-not-allowed={!archiveReadingGoal}
              disabled={!archiveReadingGoal}
              value={archivalOption.label}
              bind:group={selectedArchiveOption}
              on:change={checkDates}
            />
            <span class:opacity-50={!archiveReadingGoal}>{archivalOption.label}</span>
          </div>
        {/each}
      </div>
    {/if}
    {#if readingGoalToReplaceMessage}
      <details class="cursor-pointer max-h-[6rem] sm:max-h-[10rem] overflow-auto mt-4">
        <summary>{readingGoalToReplaceMessage}</summary>
        {#each readingGoalsToReplace as goalToReplace (goalToReplace.goalStartDate)}
          <div class="my-2 p-1">
            {getDateRangeLabel(goalToReplace.goalStartDate, goalToReplace.goalEndDate)} / {secondsToMinutes(
              goalToReplace.timeGoal
            )} min / {goalToReplace.characterGoal}
            characters / {goalToReplace.goalFrequency}
          </div>
        {/each}
      </details>
    {/if}
  </svelte:fragment>
  <div class="flex grow justify-between" slot="footer">
    <button class={buttonClasses} on:click={() => closeDialog(true)}>
      Cancel
      <Ripple />
    </button>
    <button class={buttonClasses} on:click={() => closeDialog()}>
      Confirm
      <Ripple />
    </button>
  </div>
</DialogTemplate>
