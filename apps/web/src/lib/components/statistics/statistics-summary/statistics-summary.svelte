<script lang="ts">
  import {
    faChevronLeft,
    faChevronRight,
    faClose,
    faFloppyDisk,
    faPen,
    faTrash,
    faXmark
  } from '@fortawesome/free-solid-svg-icons';
  import Popover from '$lib/components/popover/popover.svelte';
  import {
    StatisticsSummaryKey,
    type StatisticsDataSourceChange,
    type StatisticsDeleteRequest,
    type StatisticsEditRequest
  } from '$lib/components/statistics/statistics-summary/statistics-summary';
  import StatisticsSummaryHeader from '$lib/components/statistics/statistics-summary/statistics-summary-header.svelte';
  import {
    type BookStatistic,
    StatisticsReadingDataAggregationMode,
    readingTimeDataSources,
    charactersDataSources,
    readingSpeedDataSources,
    dateDataSources,
    titleDataSources
  } from '$lib/components/statistics/statistics-types';
  import { CLOSE_POPOVER } from '$lib/data/events';
  import { SortDirection } from '$lib/data/sort-types';
  import {
    lastBlurredTrackerItems$,
    lastCharactersDataSource$,
    lastPrimaryReadingDataAggregationMode$,
    lastReadingSpeedDataSource$,
    lastReadingTimeDataSource$,
    lastStatisticsEndDate$,
    lastStatisticsStartDate$,
    lastStatisticsSummarySortDirection$,
    lastStatisticsSummarySortProperty$
  } from '$lib/data/store';
  import { getNumberFromObject, secondsToMinutes } from '$lib/functions/statistic-util';
  import { reduceToEmptyString } from '$lib/functions/rxjs/reduce-to-empty-string';
  import { convertRemToPixels, dummyFn, getFullHeight, limitToRange } from '$lib/functions/utils';
  import { debounceTime, fromEvent, tap } from 'rxjs';
  import { createEventDispatcher, tick } from 'svelte';
  import Fa from 'svelte-fa';

  export let aggregratedStatistics: BookStatistic[];
  export let statisticsDateRangeLabel: string;

  const dispatch = createEventDispatcher<{
    delete: StatisticsDeleteRequest;
    edit: StatisticsEditRequest;
  }>();

  const statisticsSummaryBaseRowRem = 3;
  const statisticsSummaryBaseRowGap = 1.5;

  let renderFullStatisticsSummaryTable = window && window.matchMedia('(min-width: 768px)').matches;
  let statisticsSummaryTableContainerElm: HTMLElement;
  let statisticsSummaryPopover: Popover;
  let statisticsSummaryButtonContainer: HTMLElement;
  let statisticsData: BookStatistic[] = [];
  let currentStatisticsSummaryRows: BookStatistic[] = [];
  let statisticsSummaryGridRowMod = 0;
  let statisticsSummaryMaxPages = 0;
  let currentStatisticsSummaryPage = 1;
  let rowsPerStatisticsSummaryPage = 0;
  const statisticsSummaryPageRefs: HTMLButtonElement[] = [];
  let statisticsSummaryPagesContainer: HTMLElement;
  let statisticsSummaryPopoverDetails: string[] = [];
  let rowInEdit: BookStatistic | undefined;
  let rowInEditTime = 0;
  let rowInEditCharacters = 0;
  let rowInEditResetMinMaxValues = false;

  const resizeHandler$ = fromEvent(window, 'resize').pipe(
    debounceTime(250),
    tap(() => {
      renderFullStatisticsSummaryTable = window && window.matchMedia('(min-width: 768px)').matches;
      updateRowsPerPage(false);
    }),
    reduceToEmptyString()
  );

  $: statisticsSummaryPageLabel = `PAGE ${currentStatisticsSummaryPage} / ${statisticsSummaryMaxPages}`;

  // eslint-disable-next-line prefer-spread
  $: statisticsSummaryPages = Array.apply(null, Array(statisticsSummaryMaxPages)).map(
    (_, index) => index + 1
  );

  $: updateTableData(false, currentStatisticsSummaryPage);

  $: updateFilterAndSort($lastPrimaryReadingDataAggregationMode$);

  $: if (aggregratedStatistics) {
    setRowInEditMode();
    statisticsData = [...aggregratedStatistics];
    updateRowsPerPage();
  }

  $: if (
    $lastReadingTimeDataSource$ ||
    $lastCharactersDataSource$ ||
    $lastReadingSpeedDataSource$ ||
    $lastStatisticsSummarySortProperty$
  ) {
    let valueToSet: keyof BookStatistic | undefined;

    switch ($lastStatisticsSummarySortProperty$) {
      case 'readingTime':
      case 'averageReadingTime':
      case 'averageWeightedReadingTime':
        if ($lastStatisticsSummarySortProperty$ !== $lastReadingTimeDataSource$) {
          valueToSet = $lastReadingTimeDataSource$;
        }
        break;
      case 'charactersRead':
      case 'averageCharactersRead':
      case 'averageWeightedCharactersRead':
        if ($lastStatisticsSummarySortProperty$ !== $lastCharactersDataSource$) {
          valueToSet = $lastCharactersDataSource$;
        }
        break;
      case 'lastReadingSpeed':
      case 'minReadingSpeed':
      case 'altMinReadingSpeed':
      case 'maxReadingSpeed':
        if ($lastStatisticsSummarySortProperty$ !== $lastReadingSpeedDataSource$) {
          valueToSet = $lastReadingSpeedDataSource$;
        }
        break;

      default:
        break;
    }

    if (valueToSet) {
      $lastStatisticsSummarySortProperty$ = valueToSet;
    }

    updateTableData();
  }

  function dispatchDeleteRequest(row: BookStatistic) {
    const request: StatisticsDeleteRequest = {
      startDate: '',
      endDate: '',
      titlesToCheck: new Set<string>()
    };

    if ($lastPrimaryReadingDataAggregationMode$ === StatisticsReadingDataAggregationMode.NONE) {
      request.startDate = row.dateKey;
      request.endDate = row.dateKey;
      request.titlesToCheck.add(row.title);
    } else if (
      $lastPrimaryReadingDataAggregationMode$ === StatisticsReadingDataAggregationMode.DATE
    ) {
      request.startDate = row.dateKey;
      request.endDate = row.dateKey;
    } else {
      request.startDate = $lastStatisticsStartDate$;
      request.endDate = $lastStatisticsEndDate$;
      request.titlesToCheck.add(row.title);
    }

    dispatch('delete', request);
  }

  function handlePropertyChange({
    detail: { property, statisticsSummaryKey }
  }: CustomEvent<StatisticsDataSourceChange>) {
    switch (statisticsSummaryKey) {
      case StatisticsSummaryKey.READING_TIME:
        $lastReadingTimeDataSource$ = property;
        break;
      case StatisticsSummaryKey.CHARACTERS:
        $lastCharactersDataSource$ = property;
        break;
      case StatisticsSummaryKey.READING_SPEED:
        $lastReadingSpeedDataSource$ = property;
        break;

      default:
        break;
    }

    const wasSameProperty = property === $lastStatisticsSummarySortProperty$;

    if (wasSameProperty) {
      $lastStatisticsSummarySortDirection$ =
        $lastStatisticsSummarySortDirection$ === SortDirection.ASC
          ? SortDirection.DESC
          : SortDirection.ASC;
    }

    $lastStatisticsSummarySortProperty$ = property;

    if (wasSameProperty) {
      updateTableData();
    }
  }

  function updateRowsPerPage(executeSort = true) {
    tick().then(() => {
      rowsPerStatisticsSummaryPage = renderFullStatisticsSummaryTable
        ? Math.max(
            1,
            Math.ceil(
              (getFullHeight(window, statisticsSummaryTableContainerElm) -
                getFullHeight(window, statisticsSummaryButtonContainer, true)) /
                convertRemToPixels(
                  window,
                  statisticsSummaryBaseRowRem + statisticsSummaryBaseRowGap + 0.4
                )
            )
          )
        : 1;

      updatePageData(executeSort);
    });
  }

  function updatePageData(executeSort: boolean, newPage?: number) {
    statisticsSummaryMaxPages = Math.ceil(statisticsData.length / rowsPerStatisticsSummaryPage);
    currentStatisticsSummaryPage = newPage
      ? limitToRange(1, statisticsSummaryMaxPages, newPage)
      : limitToRange(1, statisticsSummaryMaxPages, currentStatisticsSummaryPage);

    updateTableData(executeSort);
  }

  function updateTableData(executeSort = true, pageNumber = currentStatisticsSummaryPage) {
    if (!pageNumber) {
      return;
    }

    if (executeSort) {
      applyTableSort();
    }

    const currenPageStart = (pageNumber - 1) * rowsPerStatisticsSummaryPage;

    currentStatisticsSummaryRows = statisticsData.slice(
      currenPageStart,
      currenPageStart + rowsPerStatisticsSummaryPage
    );
  }

  function applyTableSort() {
    statisticsData.sort(sortTable);
    statisticsData = [...statisticsData];
  }

  function sortTable(row1: BookStatistic, row2: BookStatistic) {
    const isTitleSort = $lastStatisticsSummarySortProperty$ === 'title';
    const isDateKeySort = $lastStatisticsSummarySortProperty$ === 'dateKey';
    const row1Prop = row1[$lastStatisticsSummarySortProperty$] || (isTitleSort ? '' : 0);
    const row2Prop = row2[$lastStatisticsSummarySortProperty$] || (isTitleSort ? '' : 0);

    let sortDiff = 0;

    if ($lastStatisticsSummarySortDirection$ === SortDirection.ASC) {
      if (isTitleSort) {
        sortDiff = row1.title.localeCompare(row2.title, 'ja-JP', { numeric: true });
      } else if (isDateKeySort) {
        if (row1Prop === row2Prop) {
          sortDiff = 0;
        } else {
          sortDiff = row1Prop > row2Prop ? 1 : -1;
        }
      } else {
        sortDiff = +row1Prop - +row2Prop;
      }
    } else if (isTitleSort) {
      sortDiff = row2.title.localeCompare(row1.title, 'ja-JP', { numeric: true });
    } else if (isDateKeySort) {
      if (row1Prop === row2Prop) {
        sortDiff = 0;
      } else {
        sortDiff = row2Prop > row1Prop ? 1 : -1;
      }
    } else {
      sortDiff = +row2Prop - +row1Prop;
    }

    if (!sortDiff) {
      sortDiff = row1.title.localeCompare(row2.title, 'ja-JP', { numeric: true });
    }

    return sortDiff;
  }

  function updateFilterAndSort(aggregrationMode: StatisticsReadingDataAggregationMode) {
    setRowInEditMode();

    switch (aggregrationMode) {
      case StatisticsReadingDataAggregationMode.DATE:
        if ($lastStatisticsSummarySortProperty$ === 'title') {
          $lastStatisticsSummarySortProperty$ = 'readingTime';
        }
        break;

      case StatisticsReadingDataAggregationMode.TITLE:
        if ($lastStatisticsSummarySortProperty$ === 'dateKey') {
          $lastStatisticsSummarySortProperty$ = 'readingTime';
        }
        break;

      default:
        $lastReadingTimeDataSource$ = 'readingTime';
        break;
    }

    statisticsSummaryGridRowMod =
      aggregrationMode === StatisticsReadingDataAggregationMode.NONE ? 0 : 1;
  }

  function setRowInEditMode(row?: BookStatistic) {
    if (row) {
      rowInEditTime = row.readingTime;
      rowInEditCharacters = row.charactersRead;
      rowInEditResetMinMaxValues = false;
      rowInEdit = row;
    } else {
      rowInEdit = undefined;
      rowInEditTime = 0;
      rowInEditCharacters = 0;
      rowInEditResetMinMaxValues = false;
    }
  }
</script>

{$resizeHandler$ ?? ''}
<div class="my-4" class:hidden={!aggregratedStatistics.length}>
  Data for {statisticsDateRangeLabel}
</div>
<div
  class="grow p-2 overflow-auto"
  class:flex={!statisticsData.length}
  class:justify-center={!statisticsData.length}
  class:items-center={!statisticsData.length}
  class:text-4xl={!statisticsData.length}
  bind:this={statisticsSummaryTableContainerElm}
>
  {#if statisticsData.length}
    {@const isNoneAggregation =
      $lastPrimaryReadingDataAggregationMode$ === StatisticsReadingDataAggregationMode.NONE}
    {@const isDateAggregation =
      $lastPrimaryReadingDataAggregationMode$ === StatisticsReadingDataAggregationMode.DATE}
    {@const isTitleAggregation =
      $lastPrimaryReadingDataAggregationMode$ === StatisticsReadingDataAggregationMode.TITLE}
    <div
      class="grid grid-cols-[0.75fr_1fr] gap-x-8 items-center"
      class:md:grid-cols-[0.31fr_0.6fr_0.77fr_0.74fr_0.6fr_0.57fr]={isNoneAggregation}
      class:lg:grid-cols-[0.14fr_0.26fr_0.85fr_repeat(2,_0.59fr)_0.45fr]={isNoneAggregation}
      class:md:grid-cols-[0.1fr_0.6fr_1fr_1.1fr_0.85fr]={isDateAggregation}
      class:lg:grid-cols-[0.1fr_repeat(4,1fr)]={isDateAggregation}
      class:md:grid-cols-[0.1fr_1fr_repeat(3,_0.45fr)]={isTitleAggregation}
      class:lg:grid-cols-[0.1fr_0.93fr_0.35fr_0.42fr_0.3fr]={isTitleAggregation}
      style:grid-auto-rows={`${statisticsSummaryBaseRowRem}rem`}
      style:row-gap={`${statisticsSummaryBaseRowGap}rem`}
    >
      {#if renderFullStatisticsSummaryTable}
        <div></div>
      {/if}
      <StatisticsSummaryHeader
        statisticsSummaryKey={StatisticsSummaryKey.DATE}
        options={dateDataSources}
        selectionKey={StatisticsSummaryKey.DATE}
        hasRowInEdit={rowInEdit !== undefined}
        isHidden={isTitleAggregation}
        gridRow={renderFullStatisticsSummaryTable ? undefined : 2}
        title="Click to select/sort by this Attribute"
        on:propertyChange={(detail) => handlePropertyChange(detail)}
      />
      <StatisticsSummaryHeader
        statisticsSummaryKey={StatisticsSummaryKey.TITLE}
        options={titleDataSources}
        selectionKey={StatisticsSummaryKey.TITLE}
        hasRowInEdit={rowInEdit !== undefined}
        isHidden={isDateAggregation}
        gridRow={renderFullStatisticsSummaryTable ? undefined : 3 - statisticsSummaryGridRowMod}
        title="Click to select/sort by this Attribute"
        on:propertyChange={(detail) => handlePropertyChange(detail)}
      />
      <StatisticsSummaryHeader
        statisticsSummaryKey={StatisticsSummaryKey.READING_TIME}
        options={readingTimeDataSources}
        selectionKey={$lastReadingTimeDataSource$}
        hasRowInEdit={rowInEdit !== undefined}
        gridRow={renderFullStatisticsSummaryTable ? undefined : 4 - statisticsSummaryGridRowMod}
        title={'Switch between Reading Time Attributes'}
        on:propertyChange={(detail) => handlePropertyChange(detail)}
      />
      <StatisticsSummaryHeader
        statisticsSummaryKey={StatisticsSummaryKey.CHARACTERS}
        options={charactersDataSources}
        selectionKey={$lastCharactersDataSource$}
        hasRowInEdit={rowInEdit !== undefined}
        gridRow={renderFullStatisticsSummaryTable ? undefined : 5 - statisticsSummaryGridRowMod}
        title={'Switch between Character Attributes'}
        on:propertyChange={(detail) => handlePropertyChange(detail)}
      />
      <StatisticsSummaryHeader
        statisticsSummaryKey={StatisticsSummaryKey.READING_SPEED}
        options={readingSpeedDataSources}
        selectionKey={$lastReadingSpeedDataSource$}
        hasRowInEdit={rowInEdit !== undefined}
        gridRow={renderFullStatisticsSummaryTable ? undefined : 6 - statisticsSummaryGridRowMod}
        title={'Switch between Reading Speed Attributes'}
        on:propertyChange={(detail) => handlePropertyChange(detail)}
      />
      {#each currentStatisticsSummaryRows as currentStatisticsSummaryRow (currentStatisticsSummaryRow.id)}
        {@const currentRowInEdit = rowInEdit && rowInEdit.id === currentStatisticsSummaryRow.id}
        {@const otherRowInEdit = rowInEdit && !currentRowInEdit}
        <div class="col-span-2 md:col-span-1">
          <button
            class="hover:text-red-500"
            class:cursor-not-allowed={otherRowInEdit}
            title={otherRowInEdit ? '' : `${rowInEdit ? 'Cancel Edit' : 'Delete Row'}`}
            disabled={otherRowInEdit}
            on:click={() => {
              if (rowInEdit) {
                setRowInEditMode();
              } else {
                dispatchDeleteRequest(currentStatisticsSummaryRow);
              }
            }}
          >
            <Fa icon={currentRowInEdit ? faXmark : faTrash} />
          </button>
          {#if isNoneAggregation}
            <button
              class="ml-2 hover:text-red-500"
              class:cursor-not-allowed={otherRowInEdit}
              title={otherRowInEdit ? '' : `${rowInEdit ? 'Save Changes' : 'Edit Row'}`}
              disabled={otherRowInEdit}
              on:click={() => {
                if (rowInEdit) {
                  dispatch('edit', {
                    dateKey: rowInEdit.dateKey,
                    title: rowInEdit.title,
                    newReadingTime: rowInEditTime,
                    newCharactersRead: rowInEditCharacters,
                    resetMinMaxValues: rowInEditResetMinMaxValues
                  });
                  setRowInEditMode();
                } else {
                  setRowInEditMode(currentStatisticsSummaryRow);
                }
              }}
            >
              <Fa icon={currentRowInEdit ? faFloppyDisk : faPen} />
            </button>
          {/if}
        </div>
        <div class:hidden={isTitleAggregation}>
          {currentStatisticsSummaryRow.dateKey}
        </div>
        <div
          tabindex="0"
          role="button"
          class="line-clamp-2"
          class:hidden={isDateAggregation}
          title={currentStatisticsSummaryRow.title}
          on:click={(event) => {
            statisticsSummaryPopoverDetails = [currentStatisticsSummaryRow.title];

            tick().then(() => {
              if (event.target instanceof HTMLElement) {
                statisticsSummaryPopover.toggleOpen(event.target);
              }
            });
          }}
          on:keyup={dummyFn}
        >
          {currentStatisticsSummaryRow.title}
        </div>
        {#if currentRowInEdit}
          <input
            class="w-full"
            type="number"
            bind:value={rowInEditTime}
            on:change={() => {
              if (rowInEdit && (!Number.isFinite(rowInEditTime) || rowInEditTime < 0)) {
                rowInEditTime = rowInEdit.readingTime;
              }
            }}
          />
        {:else}
          <button
            class="text-left"
            class:blur={$lastBlurredTrackerItems$.has('readingTime')}
            on:click={(event) => {
              statisticsSummaryPopoverDetails = [
                `Time: ${secondsToMinutes(currentStatisticsSummaryRow.readingTime)} min`,
                `Average Time: ${secondsToMinutes(
                  currentStatisticsSummaryRow.averageReadingTime
                )} min`,
                `Weighted Time: ${secondsToMinutes(
                  currentStatisticsSummaryRow.averageWeightedReadingTime
                )} min`
              ];

              tick().then(() => {
                if (event.target instanceof HTMLElement) {
                  statisticsSummaryPopover.toggleOpen(event.target);
                }
              });
            }}
          >
            {secondsToMinutes(
              getNumberFromObject(currentStatisticsSummaryRow, $lastReadingTimeDataSource$)
            )} min
          </button>
        {/if}
        {#if currentRowInEdit}
          <input
            class="w-full"
            type="number"
            bind:value={rowInEditCharacters}
            on:change={() => {
              if (rowInEdit && (!Number.isFinite(rowInEditCharacters) || rowInEditCharacters < 0)) {
                rowInEditCharacters = rowInEdit.charactersRead;
              }
            }}
          />
        {:else}
          <button
            class="text-left"
            class:blur={$lastBlurredTrackerItems$.has('charactersRead')}
            on:click={(event) => {
              statisticsSummaryPopoverDetails = [
                `Characters: ${currentStatisticsSummaryRow.charactersRead}`,
                `Average Characters: ${currentStatisticsSummaryRow.averageCharactersRead}`,
                `Weighted Characters: ${currentStatisticsSummaryRow.averageWeightedCharactersRead}`
              ];

              tick().then(() => {
                if (event.target instanceof HTMLElement) {
                  statisticsSummaryPopover.toggleOpen(event.target);
                }
              });
            }}
          >
            {getNumberFromObject(currentStatisticsSummaryRow, $lastCharactersDataSource$)}
          </button>
        {/if}
        {#if currentRowInEdit}
          <div class="flex items-center">
            <input id="reset-min-max" type="checkbox" bind:checked={rowInEditResetMinMaxValues} />
            <label for="reset-min-max" class="ml-1">Reset Min/Max</label>
          </div>
        {:else}
          <button
            class="text-left"
            class:blur={$lastBlurredTrackerItems$.has('lastReadingSpeed')}
            on:click={(event) => {
              statisticsSummaryPopoverDetails = [
                `Speed: ${currentStatisticsSummaryRow.lastReadingSpeed}`,
                `Min Speed: ${currentStatisticsSummaryRow.minReadingSpeed}`,
                `Alt Min Speed: ${currentStatisticsSummaryRow.altMinReadingSpeed}`,
                `Max Speed: ${currentStatisticsSummaryRow.maxReadingSpeed}`
              ];

              tick().then(() => {
                if (event.target instanceof HTMLElement) {
                  statisticsSummaryPopover.toggleOpen(event.target);
                }
              });
            }}
          >
            {getNumberFromObject(currentStatisticsSummaryRow, $lastReadingSpeedDataSource$)} / h
          </button>
        {/if}
      {/each}
    </div>
    {#if statisticsSummaryPopoverDetails.length}
      <Popover
        placement={renderFullStatisticsSummaryTable ? 'top-start' : 'top'}
        yOffset={5}
        containerStyles={`align-self:flex-start;display:${isDateAggregation ? 'none' : 'flex'}`}
        bind:this={statisticsSummaryPopover}
      >
        <div slot="content" class="p-4">
          <button
            class="flex w-full justify-end absolute top-1 right-2"
            on:click={() => (statisticsSummaryPopoverDetails = [])}
          >
            <Fa icon={faClose} />
          </button>
          {#each statisticsSummaryPopoverDetails as popoverDetail (popoverDetail)}
            <div class="mb-2 last:mb-0">{popoverDetail}</div>
          {/each}
        </div>
      </Popover>
    {/if}
  {:else}
    No Data found for {statisticsDateRangeLabel}
  {/if}
</div>
<div
  class="my-6 flex justify-between"
  class:invisible={statisticsSummaryMaxPages < 2}
  bind:this={statisticsSummaryButtonContainer}
>
  <button
    disabled={currentStatisticsSummaryPage === 1}
    class:opacity-25={currentStatisticsSummaryPage === 1}
    class:cursor-not-allowed={currentStatisticsSummaryPage === 1}
    on:click={() => {
      setRowInEditMode();
      currentStatisticsSummaryPage -= 1;
    }}
  >
    <Fa icon={faChevronLeft} />
  </button>
  <Popover
    yOffset={5}
    on:open={() => {
      const currentPageElement = statisticsSummaryPageRefs[currentStatisticsSummaryPage];

      if (!currentPageElement || !statisticsSummaryPagesContainer) {
        return;
      }

      const absoluteElementTop = currentPageElement.offsetTop + currentPageElement.clientHeight / 2;
      const middle = absoluteElementTop - statisticsSummaryPagesContainer.clientHeight / 2;

      statisticsSummaryPagesContainer.scrollTo(0, middle);
    }}
  >
    <div class="mx-6">{statisticsSummaryPageLabel}</div>
    <div
      slot="content"
      class="max-h-32 w-32 p-2 flex flex-col overflow-auto"
      bind:this={statisticsSummaryPagesContainer}
    >
      {#each statisticsSummaryPages as statisticsSummaryPage, pageIndex (statisticsSummaryPage)}
        <button
          class="hover:opacity-50 hover:bg-slate-300 hover:text-black"
          class:bg-slate-300={statisticsSummaryPage === currentStatisticsSummaryPage}
          class:text-black={statisticsSummaryPage === currentStatisticsSummaryPage}
          bind:this={statisticsSummaryPageRefs[pageIndex + 1]}
          on:click={({ target }) => {
            setRowInEditMode();

            currentStatisticsSummaryPage = statisticsSummaryPage;
            target?.dispatchEvent(new CustomEvent(CLOSE_POPOVER, { bubbles: true }));
          }}
        >
          {statisticsSummaryPage}
        </button>
      {/each}
    </div>
  </Popover>
  <button
    disabled={currentStatisticsSummaryPage === statisticsSummaryMaxPages}
    class:opacity-25={currentStatisticsSummaryPage === statisticsSummaryMaxPages}
    class:cursor-not-allowed={currentStatisticsSummaryPage === statisticsSummaryMaxPages}
    on:click={() => {
      setRowInEditMode();
      currentStatisticsSummaryPage += 1;
    }}
  >
    <Fa icon={faChevronRight} />
  </button>
</div>
