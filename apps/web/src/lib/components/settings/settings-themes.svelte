<script lang="ts">
  import {
    faCheck,
    faCopy,
    faDownload,
    faFileImport,
    faPen,
    faPlus,
    faTrash
  } from '@fortawesome/free-solid-svg-icons';
  import SettingsItemGroup from '$lib/components/settings/settings-item-group.svelte';
  import SettingsThemeColor from '$lib/components/settings/settings-theme-color.svelte';
  import { theme$ } from '$lib/data/store';
  import {
    customAppThemes$,
    darkTheme$,
    previewTheme$,
    selectedThemeId$,
    selectTheme,
    themeDefinitions$
  } from '$lib/data/theme/theme-store';
  import { themeTokensByGroup, type ThemeToken } from '$lib/data/theme/theme-tokens';
  import {
    builtInThemeIds,
    defaultDarkThemeId,
    defaultLightThemeId,
    exportableTheme,
    parseThemeDefinition,
    resolveTheme,
    uniqueThemeId,
    type ResolvedTheme,
    type ThemeDefinition
  } from '$lib/data/theme/themes';
  import { downloadBlob } from '$lib/functions/file-dom/download-blob';
  import { inputFile } from '$lib/functions/file-dom/input-file';
  import { onDestroy } from 'svelte';
  import Fa from 'svelte-fa';

  let editing: ThemeDefinition | undefined;
  /** Id the edited theme had when editing started (renames change the id) */
  let editingOriginalId = '';
  let importText = '';
  let importError = '';
  let showImport = false;
  let message = '';

  $: themes = ($themeDefinitions$ ?? []).map((definition) => ({
    definition,
    resolved: resolveTheme(definition.id, $customAppThemes$)
  }));
  $: baseOptions = [
    { id: 'light', name: 'Light base' },
    { id: 'dark', name: 'Dark base' },
    ...themes
      .filter(({ definition }) => definition.id !== editing?.id)
      .map(({ resolved }) => ({ id: resolved.id, name: resolved.name }))
  ];
  $: parent = editing
    ? resolveTheme(
        editing.extends || (editing.dark ? 'dark' : 'light'),
        $customAppThemes$
      )
    : undefined;
  $: previewTheme$.next(editing ? { ...editing } : undefined);

  onDestroy(() => previewTheme$.next(undefined));

  function flash(text: string) {
    message = text;
    setTimeout(() => {
      if (message === text) {
        message = '';
      }
    }, 2500);
  }

  function startNew(from?: ResolvedTheme) {
    const base = from ?? resolveTheme($selectedThemeId$ ?? $theme$, $customAppThemes$);
    const name = from ? `${from.name} (copy)` : 'My theme';

    editing = {
      id: uniqueThemeId(name, $customAppThemes$),
      name,
      extends: base.id,
      colors: {}
    };
    editingOriginalId = '';
  }

  function startEdit(definition: ThemeDefinition) {
    editing = JSON.parse(JSON.stringify(definition));
    editingOriginalId = definition.id;
  }

  function setColor(token: ThemeToken, value: string | undefined) {
    if (!editing) {
      return;
    }

    const colors = { ...(editing.colors || {}) };

    if (value === undefined) {
      delete colors[token];
    } else {
      colors[token] = value;
    }

    editing = { ...editing, colors };
  }

  function save() {
    if (!editing) {
      return;
    }

    const name = editing.name.trim() || 'Untitled theme';
    const custom = { ...$customAppThemes$ };

    if (editingOriginalId) {
      delete custom[editingOriginalId];
    }

    const id =
      editingOriginalId && editingOriginalId === editing.id
        ? editing.id
        : uniqueThemeId(name, custom);

    custom[id] = { ...editing, id, name };
    customAppThemes$.next(custom);
    // A rename changes the id; keep it selected in whichever slot used it.
    if (editingOriginalId && editingOriginalId !== id) {
      if ($theme$ === editingOriginalId) {
        theme$.next(id);
      }

      if ($darkTheme$ === editingOriginalId) {
        darkTheme$.next(id);
      }
    }
    // Select new themes; an edited one stays in the slot(s) it is in.
    if (![theme$.getValue(), darkTheme$.getValue()].includes(id)) {
      selectTheme(id);
    }
    editing = undefined;
    flash(`Saved "${name}"`);
  }

  function remove(definition: ThemeDefinition) {
    if (!window.confirm(`Delete the theme "${definition.name}"?`)) {
      return;
    }

    const custom = { ...$customAppThemes$ };

    delete custom[definition.id];
    customAppThemes$.next(custom);

    const fallback = (base: string) =>
      definition.extends && !['light', 'dark'].includes(definition.extends)
        ? definition.extends
        : base;

    if ($theme$ === definition.id) {
      theme$.next(fallback(defaultLightThemeId));
    }

    if ($darkTheme$ === definition.id) {
      darkTheme$.next(fallback(defaultDarkThemeId));
    }
  }

  function download(definition: ThemeDefinition) {
    downloadBlob(
      new Blob([exportableTheme(definition)], { type: 'application/json' }),
      `${definition.id}.json`
    );
  }

  async function copy(definition: ThemeDefinition) {
    await navigator.clipboard.writeText(exportableTheme(definition));
    flash('Copied theme JSON');
  }

  function importTheme(json: string) {
    try {
      const parsed = parseThemeDefinition(JSON.parse(json));
      const id = uniqueThemeId(parsed.id || parsed.name, $customAppThemes$);

      customAppThemes$.next({ ...$customAppThemes$, [id]: { ...parsed, id } });
      selectTheme(id);
      importError = '';
      importText = '';
      showImport = false;
      flash(`Imported "${parsed.name}"`);
    } catch (e: any) {
      importError = e instanceof SyntaxError ? `Not valid JSON: ${e.message}` : e.message;
    }
  }

  async function importFiles(files: FileList | File[]) {
    const file = Array.from(files)[0];

    if (file) {
      importTheme(await file.text());
    }
  }
</script>

<div class="flex flex-col gap-5">
  {#if !editing}
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="theme-action" on:click={() => startNew()}>
        <Fa icon={faPlus} /> New theme
      </button>
      <button type="button" class="theme-action" on:click={() => (showImport = !showImport)}>
        <Fa icon={faFileImport} /> Import
      </button>
      <span class="text-sm font-semibold text-[color:var(--app-muted-fg)]">{message}</span>
      <a
        class="ml-auto text-sm font-semibold text-[color:var(--app-muted-fg)] underline"
        href="/themes.md"
        rel="external"
        target="_blank"
        title="Explains every theme setting and the JSON format"
      >
        Theme guide (themes.md)
      </a>
    </div>

    {#if showImport}
      <SettingsItemGroup title="Import a theme">
        <p class="mb-2 text-sm text-[color:var(--app-muted-fg)]">
          Paste theme JSON or choose a .json file.
        </p>
        <textarea
          class="theme-code w-full"
          rows="8"
          spellcheck="false"
          placeholder={'{\n  "name": "My theme",\n  "extends": "dark-theme",\n  "colors": { "accent": "#e879f9" }\n}'}
          bind:value={importText}
        />
        {#if importError}
          <p class="mt-1 text-sm text-[color:var(--app-danger-color)]">{importError}</p>
        {/if}
        <div class="mt-2 flex gap-2">
          <button
            type="button"
            class="theme-action"
            disabled={!importText.trim()}
            on:click={() => importTheme(importText)}
          >
            Import JSON
          </button>
          <label class="theme-action cursor-pointer">
            <input type="file" accept="application/json,.json" hidden use:inputFile={importFiles} />
            Choose file
          </label>
        </div>
      </SettingsItemGroup>
    {/if}

    <div class="theme-gallery">
      {#each themes as { definition, resolved } (definition.id)}
        {@const colors = resolved.colors}
        {@const custom = !builtInThemeIds.has(definition.id)}
        <div class="theme-card" class:theme-card-active={$selectedThemeId$ === definition.id}>
          <button
            type="button"
            class="theme-preview"
            style:background={colors.background}
            title="Use {resolved.name}"
            on:click={() => selectTheme(definition.id)}
          >
            <span class="theme-preview-header" style:background={colors.headerBackground}>
              <span style:background={colors.headerIcon} />
              <span style:background={colors.headerIcon} />
            </span>
            <span class="theme-preview-body">
              <span
                class="theme-preview-card"
                style:background={colors.surfaceStrong}
                style:border-color={colors.border}
              >
                <span style:background={colors.text} />
                <span style:background={colors.mutedText} />
                <span class="theme-preview-accent" style:background={colors.accent} />
              </span>
              <span
                class="theme-preview-page"
                style:background={colors.readerBackground}
                style:color={colors.readerText}
              >
                あ亜<mark style:background={colors.highlightYellow} style:color="inherit">ア</mark>
              </span>
            </span>
          </button>
          <div class="theme-card-footer">
            <span class="min-w-0 flex-1 truncate font-bold">
              {#if $selectedThemeId$ === definition.id}<Fa icon={faCheck} class="mr-1 inline" />{/if}
              {resolved.name}
            </span>
            {#if custom}
              <button class="theme-icon" title="Edit" on:click={() => startEdit(definition)}>
                <Fa icon={faPen} />
              </button>
            {/if}
            <button class="theme-icon" title="Duplicate and edit" on:click={() => startNew(resolved)}>
              <Fa icon={faPlus} />
            </button>
            <button class="theme-icon" title="Copy JSON" on:click={() => copy(definition)}>
              <Fa icon={faCopy} />
            </button>
            <button class="theme-icon" title="Download JSON" on:click={() => download(definition)}>
              <Fa icon={faDownload} />
            </button>
            {#if custom}
              <button class="theme-icon" title="Delete" on:click={() => remove(definition)}>
                <Fa icon={faTrash} />
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else if parent}
    <div class="theme-editor-bar app-surface-card">
      <span class="text-sm font-semibold text-[color:var(--app-muted-fg)]">
        Editing - changes show live across the app
      </span>
      <span class="flex-1" />
      <button type="button" class="theme-action" on:click={() => copy(editing ?? { id: '', name: '' })}>
        <Fa icon={faCopy} /> JSON
      </button>
      <button type="button" class="theme-action" on:click={() => (editing = undefined)}>
        Cancel
      </button>
      <button type="button" class="theme-action theme-action-primary" on:click={save}>
        <Fa icon={faCheck} /> Save
      </button>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SettingsItemGroup title="General">
        <div class="flex flex-col gap-3 text-sm">
          <label class="theme-field">
            <span>Name</span>
            <input type="text" bind:value={editing.name} />
          </label>
          <label class="theme-field">
            <span>Based on</span>
            <select bind:value={editing.extends}>
              {#each baseOptions as option (option.id)}
                <option value={option.id}>{option.name}</option>
              {/each}
            </select>
          </label>
          <label class="theme-field">
            <span>Dark theme</span>
            <select
              value={editing.dark === undefined ? 'inherit' : String(editing.dark)}
              on:change={(event) => {
                const { value } = event.currentTarget;
                if (editing) {
                  editing = { ...editing, dark: value === 'inherit' ? undefined : value === 'true' };
                }
              }}
            >
              <option value="inherit">Same as base ({parent.dark ? 'dark' : 'light'})</option>
              <option value="true">Dark</option>
              <option value="false">Light</option>
            </select>
          </label>
          <label class="theme-field">
            <span>Roundness ({(editing.radius ?? parent.radius).toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={editing.radius ?? parent.radius}
              on:input={(event) =>
                editing && (editing = { ...editing, radius: Number(event.currentTarget.value) })}
            />
          </label>
          <label class="theme-field">
            <span>Glass blur ({editing.blur ?? parent.blur}px)</span>
            <input
              type="range"
              min="0"
              max="48"
              step="1"
              value={editing.blur ?? parent.blur}
              on:input={(event) =>
                editing && (editing = { ...editing, blur: Number(event.currentTarget.value) })}
            />
          </label>
          <label class="theme-field">
            <span>Interface font</span>
            <input
              type="text"
              placeholder="Noto Sans JP"
              value={editing.uiFont ?? ''}
              on:change={(event) =>
                editing &&
                (editing = { ...editing, uiFont: event.currentTarget.value.trim() || undefined })}
            />
          </label>
        </div>
      </SettingsItemGroup>

      <SettingsItemGroup
        title="Custom CSS"
        tooltip="Added after the theme variables. Use the CSS variables listed in themes.md, e.g. .app-surface-card {'{'} border-width: 2px; {'}'}"
      >
        <textarea
          class="theme-code h-full min-h-[14rem] w-full"
          spellcheck="false"
          placeholder={'/* Example */\n.book-content {\n  letter-spacing: 0.02em;\n}'}
          value={editing.customCss ?? ''}
          on:input={(event) =>
            editing &&
            (editing = { ...editing, customCss: event.currentTarget.value || undefined })}
        />
      </SettingsItemGroup>
    </div>

    {#each themeTokensByGroup as { group, tokens } (group)}
      <SettingsItemGroup title={group}>
        {#each tokens as info (info.token)}
          <SettingsThemeColor
            label={info.label}
            description={info.description}
            cssVar={info.cssVar}
            value={editing.colors?.[info.token]}
            inherited={parent.colors[info.token]}
            on:change={({ detail }) => setColor(info.token, detail)}
          />
        {/each}
      </SettingsItemGroup>
    {/each}
  {/if}
</div>

<style>
  .theme-action {
    display: inline-flex;
    min-height: 2.4rem;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.85rem;
    border: 1px solid var(--app-control-border);
    border-radius: calc(0.85rem * var(--app-radius-scale));
    background: var(--app-control-bg);
    font-size: 0.85rem;
    font-weight: 700;
  }

  .theme-action:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--accent-color) 40%, var(--app-control-border));
  }

  .theme-action:disabled {
    opacity: 0.5;
  }

  .theme-action-primary {
    border-color: var(--accent-color);
    background: var(--accent-color);
    color: var(--app-accent-fg);
  }

  .theme-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 1rem;
  }

  .theme-card {
    overflow: hidden;
    border: 1px solid var(--border-color);
    border-radius: calc(1rem * var(--app-radius-scale));
    background: var(--surface-strong-color);
  }

  .theme-card-active {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 35%, transparent);
  }

  .theme-preview {
    display: flex;
    width: 100%;
    height: 7.5rem;
    flex-direction: column;
    text-align: left;
  }

  .theme-preview-header {
    display: flex;
    height: 1.1rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: flex-end;
    gap: 0.25rem;
    padding: 0 0.4rem;
  }

  .theme-preview-header span {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 999px;
  }

  .theme-preview-body {
    display: grid;
    flex: 1;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    padding: 0.5rem;
  }

  .theme-preview-card {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.45rem;
    border: 1px solid;
    border-radius: 0.5rem;
  }

  .theme-preview-card span {
    height: 0.3rem;
    border-radius: 999px;
  }

  .theme-preview-card span:nth-child(2) {
    width: 70%;
  }

  .theme-preview-accent {
    width: 45%;
    margin-top: auto;
  }

  .theme-preview-page {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    font-family: 'Noto Serif JP', serif;
    font-size: 1.15rem;
  }

  .theme-card-footer {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    padding: 0.45rem 0.5rem 0.45rem 0.75rem;
    border-top: 1px solid var(--border-color);
    font-size: 0.85rem;
  }

  .theme-icon {
    padding: 0.35rem;
    border-radius: 0.5rem;
    color: var(--app-muted-fg);
  }

  .theme-icon:hover {
    background: color-mix(in srgb, var(--font-color) 8%, transparent);
    color: var(--font-color);
  }

  .theme-editor-bar {
    position: sticky;
    top: 4.5rem;
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    border-radius: calc(1rem * var(--app-radius-scale));
  }

  .theme-field {
    display: grid;
    grid-template-columns: 9.5rem minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
    font-weight: 600;
  }

  .theme-field input[type='text'],
  .theme-field select {
    padding: 0.35rem 0.6rem;
    border-radius: 0.5rem;
  }

  .theme-code {
    padding: 0.6rem;
    border: 1px solid var(--app-control-border);
    border-radius: 0.6rem;
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
  }
</style>
