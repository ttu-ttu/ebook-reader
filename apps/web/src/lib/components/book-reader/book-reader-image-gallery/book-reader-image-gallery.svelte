<script lang="ts">
  import { onKeyDownReaderImageGallery } from '../../../../routes/b/on-keydown-reader';
  import { faChevronLeft, faChevronRight, faXmark } from '@fortawesome/free-solid-svg-icons';
  import { readerImageGalleryPictures$ } from '$lib/components/book-reader/book-reader-image-gallery/book-reader-image-gallery';
  import {
    hideSpoilerImage$,
    readerImageGalleryKeybindMap$,
    skipKeyDownListener$
  } from '$lib/data/store';
  import { createEventDispatcher, onMount } from 'svelte';
  import { quintInOut } from 'svelte/easing';
  import Fa from 'svelte-fa';
  import { fly } from 'svelte/transition';

  export let fontColor: string;
  export let backgroundColor: string;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let contentContainer: HTMLElement;
  let imageContainer: HTMLElement;
  let selectedImageIndex = window.matchMedia('(min-width: 1024px)').matches ? 0 : -1;

  $: selectedImage = $readerImageGalleryPictures$[selectedImageIndex];

  $: if (imageContainer && selectedImage) {
    imageContainer.focus();
  }

  onMount(() => {
    $skipKeyDownListener$ = true;

    return () => ($skipKeyDownListener$ = false);
  });

  function onKeyDown(ev: KeyboardEvent) {
    const result = onKeyDownReaderImageGallery(
      ev,
      readerImageGalleryKeybindMap$.getValue(),
      previousImage,
      nextImage,
      closeReaderImageGallery
    );

    if (!result) return;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    ev.preventDefault();
  }

  function onWheel(ev: WheelEvent) {
    if (document.activeElement !== imageContainer) {
      return;
    }

    if (ev.deltaY < 0) {
      previousImage();
    } else {
      nextImage();
    }

    ev.preventDefault();
  }

  function closeReaderImageGallery() {
    dispatch('close');
  }

  function toggleGalleryPictureSpoiler(galleryPictureUrl: string) {
    $readerImageGalleryPictures$ = $readerImageGalleryPictures$.map((galleryPicture) => {
      const picture = galleryPicture;

      if (picture.url === galleryPictureUrl) {
        picture.unspoilered = !galleryPicture.unspoilered;
      }

      return picture;
    });

    if (selectedImageIndex !== -1) {
      selectedImage = { ...$readerImageGalleryPictures$[selectedImageIndex] };
    }
  }

  function previousImage() {
    if (selectedImageIndex <= 0) {
      return;
    }

    updateImage(-1);
  }

  function nextImage() {
    if (
      selectedImageIndex === -1 ||
      selectedImageIndex === $readerImageGalleryPictures$.length - 1
    ) {
      return;
    }

    updateImage(1);
  }

  function updateImage(indexMod: number) {
    selectedImageIndex += indexMod;

    const elm = contentContainer.querySelector(`button[data-image-index="${selectedImageIndex}"]`);

    if (elm instanceof HTMLElement) {
      const absoluteElementTop = elm.offsetTop + elm.clientHeight / 2;
      const middle = absoluteElementTop - contentContainer.clientHeight / 2;

      contentContainer.scrollTo(0, middle);
    }
  }
</script>

<svelte:window on:keydown={onKeyDown} on:wheel|nonpassive={onWheel} />
<div
  class="flex h-full w-full writing-horizontal-tb fixed top-0 left-0 z-[60]"
  style:color={fontColor}
>
  <div
    tabindex="-1"
    class="flex-1 flex-col justify-between overflow-auto lg:max-w-md"
    style:background-color={backgroundColor}
    in:fly|local={{ x: -100, duration: 100, easing: quintInOut }}
    bind:this={contentContainer}
  >
    <div
      class="sticky top-0 flex justify-between p-2 z-10"
      style:background-color={backgroundColor}
    >
      <button
        title="Close Image Gallery"
        class="flex items-end md:items-center"
        on:click={closeReaderImageGallery}
      >
        <Fa icon={faXmark} />
      </button>
    </div>
    <div class="flex flex-col overflow-auto p-2">
      {#each $readerImageGalleryPictures$ as readerImageGalleryPicture, urlIndex (readerImageGalleryPicture.url)}
        {@const showSpoiler = $hideSpoilerImage$ && !readerImageGalleryPicture.unspoilered}
        <button
          class="flex justify-center my-4"
          class:spoiler={showSpoiler}
          data-image-index={urlIndex}
          on:click={() => {
            if (window.matchMedia('(min-width: 1024px)').matches) {
              selectedImageIndex = urlIndex;
            }
          }}
        >
          <img
            src={readerImageGalleryPicture.url}
            alt="galleryImage"
            class="max-h-96 lg:max-h-64"
          />
          {#if showSpoiler}
            <button
              title="Show Image"
              class="spoiler-label"
              aria-hidden="true"
              on:click={() => toggleGalleryPictureSpoiler(readerImageGalleryPicture.url)}
            >
              ネタバレ
            </button>
          {/if}
        </button>
      {/each}
    </div>
  </div>
  <div
    tabindex="-1"
    class="invisible tap-highlight-transparent bg-black/[.85] lg:visible lg:flex lg:flex-1 lg:flex-col"
    bind:this={imageContainer}
  >
    {#if selectedImage}
      {@const showSpoiler = $hideSpoilerImage$ && !selectedImage.unspoilered}
      <div class="flex flex-1">
        <button
          title="Previous Image"
          class="mx-4 text-5xl hover:text-red-500"
          class:invisible={!selectedImageIndex}
          on:click={previousImage}
        >
          <Fa icon={faChevronLeft} />
        </button>
        <div class="flex justify-center items-center flex-1" class:spoiler={showSpoiler}>
          <img class="max-h-[94vh]" src={selectedImage.url} alt="currentImage" />
          {#if showSpoiler}
            <button
              title="Show Image"
              class="spoiler-label"
              aria-hidden="true"
              on:click={() => toggleGalleryPictureSpoiler(selectedImage.url)}
            >
              ネタバレ
            </button>
          {/if}
        </div>
        <button
          title="Next Image"
          class="mx-4 text-5xl hover:text-red-500"
          class:invisible={selectedImageIndex === $readerImageGalleryPictures$.length - 1}
          on:click={nextImage}
        >
          <Fa icon={faChevronRight} />
        </button>
      </div>
      <div class="pb-2 text-center text-white">
        {selectedImageIndex + 1} / {$readerImageGalleryPictures$.length}
      </div>
    {/if}
  </div>
</div>

<style>
  .spoiler {
    overflow: hidden;
    position: relative;
  }

  .spoiler .spoiler-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #dcddde;
    background-color: rgba(0, 0, 0, 0.6);
    display: inline-block;
    padding: 12px 8px;
    border-radius: 20px;
    font-size: 15px;
    font-family: 'Noto Sans JP', sans-serif;
    text-transform: uppercase;
    font-weight: 700;
    cursor: pointer;
  }

  .spoiler .spoiler-label:hover {
    color: #ffffff;
    background-color: rgba(0, 0, 0, 0.9);
  }

  .spoiler img {
    filter: blur(44px);
  }
</style>
