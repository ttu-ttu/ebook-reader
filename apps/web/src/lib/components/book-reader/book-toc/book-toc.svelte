<script lang="ts">
  import { faXmark, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
  import { onMount } from 'svelte';
  import Fa from 'svelte-fa';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { getChapterData, nextChapter$, tocIsOpen$, type SectionWithProgress } from './book-toc';

  export let sectionData: SectionWithProgress[] = [];
  export let exploredCharCount = 0;

  let chapters: SectionWithProgress[] = [];
  let currentChapter: SectionWithProgress;
  let currentChapterIndex = -1;
  let currentChapterCharacterProgress = '0/0';
  let currentChapterProgress = '0.00';

  $: prevChapterAvailable = !!currentChapterIndex;
  $: nextChapterAvailable = currentChapterIndex < chapters.length - 1;

  $: if (sectionData) {
    const [mainChapters, chapterIndex, referenceId] = getChapterData(sectionData);
    const relevantSections = sectionData.filter(
      (section) => section.reference === referenceId || section.parentChapter === referenceId
    );

    currentChapterProgress = weightedProgressAverage(
      relevantSections.map((section) => section.progress),
      relevantSections.map((section) => section.charactersWeight)
    ).toFixed(2);
    chapters = mainChapters;
    currentChapterIndex = chapterIndex;
    currentChapter = mainChapters[currentChapterIndex];
  }

  $: if (currentChapter) {
    scrollToChapterItem(document.getElementById(`for${currentChapter.reference}`));

    const endCharacter = currentChapter.characters as number;

    currentChapterCharacterProgress = `${Math.min(
      Math.max(exploredCharCount - (currentChapter.startCharacter as number), 0),
      endCharacter
    )} / ${endCharacter}`;
  }

  onMount(() => {
    dialogManager.dialogs$.next([
      {
        component: '<div/>'
      }
    ]);
    if (currentChapter) {
      scrollToChapterItem(document.getElementById(`for${currentChapter.reference}`));
    }
  });

  function weightedProgressAverage(progressValues: number[], characterWeights: number[]) {
    const [sum, weightedSum] = characterWeights.reduce(
      (result, current, index) => {
        // eslint-disable-next-line no-param-reassign
        result[0] += progressValues[index] * current;
        // eslint-disable-next-line no-param-reassign
        result[1] += current;
        return result;
      },
      [0, 0]
    );
    return sum / weightedSum;
  }

  function scrollToChapterItem(elm: HTMLElement | null) {
    if (!elm) {
      return;
    }

    if (elm.scrollIntoViewIfNeeded) {
      elm.scrollIntoViewIfNeeded();
    } else {
      elm.scrollIntoView();
    }
  }

  function changeChapter(canNavigate: boolean, indexMod: number) {
    if (canNavigate) {
      const nextChapter = chapters[currentChapterIndex + indexMod];

      goToChapter(nextChapter.reference, false);
    }
  }

  function goToChapter(chapterId: string, closeToc = false) {
    nextChapter$.next(chapterId);

    if (closeToc) {
      tocIsOpen$.next(false);
      dialogManager.dialogs$.next([]);
    }
  }
</script>

<div class="flex justify-between p-4">
  <div>Chapter Progress: {currentChapterCharacterProgress} ({currentChapterProgress}%)</div>
  <div class="cursor-pointer" on:click={() => tocIsOpen$.next(false)}>
    <Fa icon={faXmark} />
  </div>
</div>
<div class="flex-1 overflow-auto p-4">
  {#each chapters as chapter (chapter.reference)}
    <div class="my-6 flex justify-between">
      <div
        id={`for${chapter.reference}`}
        class="mr-4 cursor-pointer"
        class:opacity-30={chapter.progress === 100 && chapter !== currentChapter}
        class:hover:opacity-100={chapter.progress === 100 && chapter !== currentChapter}
        class:hover:opacity-60={chapter.progress < 100 || chapter === currentChapter}
        on:click={() => goToChapter(chapter.reference, true)}
      >
        {chapter.label}
      </div>
      <div class:opacity-30={chapter.progress === 100 && chapter !== currentChapter}>
        {chapter.startCharacter}
      </div>
    </div>
  {/each}
</div>
<div class="flex justify-between px-4 py-6">
  <div
    class="cursor-pointer"
    class:opacity-30={!prevChapterAvailable}
    on:click={() => changeChapter(prevChapterAvailable, -1)}
  >
    <Fa icon={faChevronLeft} />
  </div>
  <div
    class="cursor-pointer"
    class:opacity-30={!nextChapterAvailable}
    on:click={() => changeChapter(nextChapterAvailable, 1)}
  >
    <Fa icon={faChevronRight} />
  </div>
</div>
