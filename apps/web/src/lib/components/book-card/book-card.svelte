<script lang="ts">
  import { faImage } from '@fortawesome/free-regular-svg-icons';
  import { onDestroy } from 'svelte';
  import Fa from 'svelte-fa';

  export let imagePath: string | Blob;
  export let title: string;

  let objectUrl = '';

  onDestroy(() => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  });

  function convertImagePath(value: string | Blob) {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = '';
    }
    if (typeof value !== 'string') {
      objectUrl = URL.createObjectURL(
        value.type ? value : new Blob([value], { type: 'image/jpeg' })
      );

      return objectUrl;
    }

    return value;
  }

  function mapImagePathFactory() {
    let prevValue: string | Blob | undefined;
    let prevResponse: string | undefined;

    const isEqual = (newValue: string | Blob) => {
      if (!prevValue) return false;
      if (prevValue instanceof Blob && newValue instanceof Blob) {
        return prevValue.type === newValue.type && prevValue.size === newValue.size;
      }
      if (typeof prevValue !== 'object' || typeof newValue !== 'object') {
        return prevValue === newValue;
      }
      return false;
    };

    return (value: string | Blob) => {
      if (isEqual(value)) return prevResponse as string;

      prevValue = value;
      prevResponse = convertImagePath(value);

      return prevResponse;
    };
  }

  const mapImagePath = mapImagePathFactory();

  let imgEl: HTMLImageElement | undefined;
  let imageLoading = true;

  $: imageLoadComplete = imgEl?.complete && !imageLoading;
  $: alt = `${title}_cover`;
</script>

<div
  class="relative aspect-[375/529] w-full overflow-hidden bg-[color:color-mix(in_srgb,var(--font-color)_5%,var(--surface-color))]"
>
  {#if !imageLoadComplete}
    <div
      class="absolute inset-0 flex items-center justify-center text-4xl text-[color:color-mix(in_srgb,var(--font-color)_22%,transparent)]"
    >
      <Fa icon={faImage} />
    </div>
  {/if}

  {#if imagePath}
    <img
      decoding="async"
      loading="lazy"
      referrerpolicy="no-referrer"
      class="book-cover relative h-full w-full object-cover transition delay-150 duration-700 ease-out"
      class:blur={!imageLoadComplete}
      src={mapImagePath(imagePath)}
      {alt}
      bind:this={imgEl}
      on:load={() => (imageLoading = false)}
    />
  {/if}
</div>
