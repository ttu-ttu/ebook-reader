<script lang="ts">
  import SettingsItemGroup from '$lib/components/settings/settings-item-group.svelte';
  import SettingsSection from '$lib/components/settings/settings-section.svelte';
  import AiLanguageToggle from '$lib/components/ai-language-toggle.svelte';
  import { inputClasses } from '$lib/css-classes';
  import { faArrowDown, faArrowUp, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
  import {
    askAiDefaultPreset$,
    askAiPresets$,
    askAiReaderNote$,
    defaultAskAiPresets,
    defaultOpenRouterModel,
    lorebookAutoInterval$,
    openRouterApiKey$,
    openRouterModel$,
    openRouterRecapModel$,
    defaultElevenLabsModel,
    elevenLabsApiKey$,
    elevenLabsModel$,
    ttsPlaybackRate$,
    ttsVoiceId$
  } from '$lib/data/ai-settings';
  import { listOpenRouterModels, type OpenRouterModel } from '$lib/data/ask-ai';
  import { onMount } from 'svelte';
  import Fa from 'svelte-fa';

  let models: OpenRouterModel[] = [];
  let modelsError = '';

  $: knownModel = !models.length || models.some((model) => model.id === $openRouterModel$);

  function updatePreset(index: number, changes: Partial<{ label: string; prompt: string }>) {
    $askAiPresets$ = $askAiPresets$.map((preset, i) =>
      i === index ? { ...preset, ...changes } : preset
    );
  }

  function movePreset(index: number, offset: number) {
    const presets = [...$askAiPresets$];
    const [preset] = presets.splice(index, 1);

    presets.splice(index + offset, 0, preset);
    $askAiPresets$ = presets;
  }

  function addPreset() {
    $askAiPresets$ = [
      ...$askAiPresets$,
      { id: `custom-${Date.now().toString(36)}`, label: 'New', prompt: '' }
    ];
  }

  onMount(() => {
    listOpenRouterModels()
      .then((result) => {
        models = result;
      })
      .catch((error) => {
        modelsError = error.message;
      });
  });
</script>

<SettingsSection id="ai-guide" keywords="api key openrouter elevenlabs voice">
  <SettingsItemGroup
    title="OpenRouter (Ask AI, Story so far, Lorebook)"
    tooltip="OpenRouter gives one key for models from many providers. You pay per request; a question with the default Flash models costs a fraction of a cent."
  >
    <ol class="guide-steps">
      <li>
        Create an account at
        <a href="https://openrouter.ai" target="_blank" rel="noreferrer">openrouter.ai</a>.
      </li>
      <li>
        Add credits in
        <a href="https://openrouter.ai/settings/credits" target="_blank" rel="noreferrer"
          >Settings → Credits</a
        >.
      </li>
      <li>
        Create a key in
        <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer"
          >Settings → API Keys</a
        >. Give it a credit limit so a leaked key can't cost much.
      </li>
      <li>
        Copy the key (it starts with <code>sk-or-</code> and is only shown once) and paste it
        into <a href="#ai-ask">OpenRouter API key</a>.
      </li>
      <li>The default models work well; you can pick any other OpenRouter model there.</li>
    </ol>
  </SettingsItemGroup>
  <SettingsItemGroup
    title="ElevenLabs (AI voice)"
    tooltip="ElevenLabs reads the book aloud. Plans include a number of characters a month; reading uses one per character."
  >
    <ol class="guide-steps">
      <li>
        Create an account at
        <a href="https://elevenlabs.io" target="_blank" rel="noreferrer">elevenlabs.io</a>.
      </li>
      <li>
        Open API Keys (in the account menu) and create a key. Allowing only Text to Speech and
        setting a credit limit keeps a leaked key harmless.
      </li>
      <li>
        Copy the key (it starts with <code>sk_</code>) and paste it into
        <a href="#ai-read-aloud">ElevenLabs API key</a>.
      </li>
      <li>
        In Voices, choose a voice that speaks Japanese, open its menu, choose "Copy voice ID" and
        paste it into ElevenLabs voice ID.
      </li>
      <li>Open a book and press the headphones icon, then "AI voice".</li>
    </ol>
  </SettingsItemGroup>
  <SettingsItemGroup
    title="Where the keys go"
    tooltip="Keys are kept in this browser and, when signed in, in your account on this server, so your other devices get them. They are removed from the browser when you sign out, and keys typed while signed out are removed when someone signs in. The browser sends them only to OpenRouter and ElevenLabs."
    wide
  />
</SettingsSection>

<SettingsSection id="ai-ask">
  <SettingsItemGroup
    title="OpenRouter API key"
    tooltip="Requests go from this browser straight to OpenRouter. Synced to your account when signed in."
  >
    <input
      id="openrouter-key"
      type="password"
      autocomplete="off"
      placeholder="sk-or-..."
      aria-label="OpenRouter API key"
      class={inputClasses}
      bind:value={$openRouterApiKey$}
    />
    <a class="mt-2 inline-block text-xs underline" href="#ai-guide">How to get a key</a>
  </SettingsItemGroup>
  <SettingsItemGroup
    title="AI language"
    tooltip="Language of the prompts and answers for Ask AI, Story so far and the lorebook. Also switchable in the reader's panels."
  >
    <AiLanguageToggle />
  </SettingsItemGroup>
  <SettingsItemGroup
    title="Model"
    tooltip="Used for Ask AI, and for recaps unless a recap model is set."
  >
    <input
      id="openrouter-model"
      aria-label="Model"
      list="openrouter-models"
      autocomplete="off"
      placeholder={defaultOpenRouterModel}
      class={inputClasses}
      bind:value={$openRouterModel$}
      on:change={() => {
        if (!$openRouterModel$.trim()) {
          openRouterModel$.next(defaultOpenRouterModel);
        }
      }}
    />
    <datalist id="openrouter-models">
      {#each models as model (model.id)}
        <option value={model.id}>{model.name}</option>
      {/each}
    </datalist>
    <p class="mt-2 text-xs text-[color:var(--app-muted-fg)]">
      {#if modelsError}
        {modelsError}
      {:else if !knownModel}
        Not in OpenRouter's model list - check the ID.
      {:else}
        Type to search {models.length || ''} models, e.g. "claude", "gemini" or "deepseek".
      {/if}
    </p>
  </SettingsItemGroup>
  <SettingsItemGroup
    title="About you"
    tooltip="Added to every Ask AI question, e.g. your level or how you like answers: &quot;I'm around JLPT N3; keep answers short and give readings for kanji above N3.&quot;"
    wide
  >
    <textarea
      id="ask-ai-reader-note"
      class="{inputClasses} min-h-[2.5rem] w-full"
      rows="2"
      aria-label="About you"
      placeholder="Optional"
      bind:value={$askAiReaderNote$}
    />
  </SettingsItemGroup>
</SettingsSection>

<SettingsSection id="ai-presets" wide>
  <SettingsItemGroup
    title="Ask AI presets"
    tooltip="Each button sends its prompt about the selected passage (or as a follow-up)."
    wide
  >
    <div class="flex flex-col gap-3">
      {#each $askAiPresets$ as preset, index (preset.id)}
        <div class="preset-row">
          <input
            class={inputClasses}
            aria-label="Button label"
            value={preset.label}
            on:change={(event) => updatePreset(index, { label: event.currentTarget.value })}
          />
          <textarea
            class="{inputClasses} min-h-[2.5rem]"
            rows="2"
            aria-label="Prompt"
            value={preset.prompt}
            on:change={(event) => updatePreset(index, { prompt: event.currentTarget.value })}
          />
          <span class="flex items-center gap-1">
            <button
              class="p-1.5 disabled:opacity-30"
              title="Move up"
              disabled={index === 0}
              on:click={() => movePreset(index, -1)}><Fa icon={faArrowUp} /></button
            >
            <button
              class="p-1.5 disabled:opacity-30"
              title="Move down"
              disabled={index === $askAiPresets$.length - 1}
              on:click={() => movePreset(index, 1)}><Fa icon={faArrowDown} /></button
            >
            <button
              class="p-1.5"
              title="Delete"
              on:click={() => ($askAiPresets$ = $askAiPresets$.filter((_, i) => i !== index))}
              ><Fa icon={faTrash} /></button
            >
          </span>
        </div>
      {/each}
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <button class="flex items-center gap-1.5 font-semibold" on:click={addPreset}>
          <Fa icon={faPlus} /> Add preset
        </button>
        <button
          class="font-semibold text-[color:var(--app-muted-fg)] underline"
          on:click={() => ($askAiPresets$ = defaultAskAiPresets)}
        >
          Reset to defaults
        </button>
        <label class="ml-auto flex items-center gap-2">
          When the panel opens
          <select bind:value={$askAiDefaultPreset$}>
            <option value="">wait for a choice</option>
            {#each $askAiPresets$ as preset (preset.id)}
              <option value={preset.id}>run "{preset.label}"</option>
            {/each}
          </select>
        </label>
      </div>
    </div>
  </SettingsItemGroup>
</SettingsSection>

<SettingsSection id="ai-read-aloud">
  <SettingsItemGroup
    title="ElevenLabs API key"
    tooltip="Requests go from this browser straight to api.elevenlabs.io. Synced to your account when signed in."
  >
    <input
      id="tts-key"
      type="password"
      autocomplete="off"
      placeholder="sk_..."
      aria-label="ElevenLabs API key"
      class={inputClasses}
      bind:value={$elevenLabsApiKey$}
    />
  </SettingsItemGroup>
  <SettingsItemGroup
    title="ElevenLabs model"
    tooltip="Model ID for text to speech with timestamps, e.g. eleven_v4 or eleven_v4_turbo."
  >
    <input
      id="tts-model"
      list="elevenlabs-models"
      autocomplete="off"
      aria-label="ElevenLabs model"
      placeholder={defaultElevenLabsModel}
      class={inputClasses}
      bind:value={$elevenLabsModel$}
    />
    <datalist id="elevenlabs-models">
      <option value="eleven_v4" />
      <option value="eleven_v4_turbo" />
      <option value="eleven_multilingual_v2" />
    </datalist>
  </SettingsItemGroup>
  <SettingsItemGroup
    title="AI voice speed"
    tooltip="Plays the voice faster or slower without changing its pitch; the highlight follows."
  >
    <select id="tts-speed" aria-label="AI voice speed" bind:value={$ttsPlaybackRate$}>
      {#each [0.75, 0.9, 1, 1.1, 1.25, 1.5] as rate}
        <option value={rate}>{rate}×</option>
      {/each}
    </select>
  </SettingsItemGroup>
  <SettingsItemGroup title="ElevenLabs voice ID" tooltip="The voice used to read the book.">
    <input
      id="tts-voice"
      autocomplete="off"
      placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
      aria-label="ElevenLabs voice ID"
      class={inputClasses}
      bind:value={$ttsVoiceId$}
    />
  </SettingsItemGroup>
</SettingsSection>

<SettingsSection id="ai-recap">
  <SettingsItemGroup
    title="Recap model"
    tooltip="Recaps summarise each finished chapter once (cached per browser), then write a recap. A cheaper, fast model works well here."
  >
    <input
      id="recap-model"
      list="openrouter-models"
      autocomplete="off"
      aria-label="Recap model"
      placeholder="Same as Ask AI ({$openRouterModel$})"
      class={inputClasses}
      bind:value={$openRouterRecapModel$}
    />
  </SettingsItemGroup>
  <SettingsItemGroup
    title="Update the lorebook automatically"
    tooltip="While reading, the lorebook (characters, places, terms) is updated in the background each time you read this many new characters. Only the new text is sent, to the recap model. 0 turns it off."
  >
    <input
      id="lorebook-interval"
      type="number"
      min="0"
      step="5000"
      aria-label="Characters between lorebook updates"
      placeholder="0 (off)"
      class={inputClasses}
      bind:value={$lorebookAutoInterval$}
    />
  </SettingsItemGroup>
</SettingsSection>

<style>
  .guide-steps {
    display: grid;
    gap: 0.35rem;
    padding-left: 1.2rem;
    font-size: 0.88rem;
    list-style: decimal;
  }

  .guide-steps a {
    text-decoration: underline;
  }

  .preset-row {
    display: grid;
    grid-template-columns: 8rem minmax(0, 1fr) auto;
    align-items: start;
    gap: 0.75rem;
  }

  @media (max-width: 640px) {
    .preset-row {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .preset-row textarea {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }
</style>
