<script lang="ts">
  import {
    Button,
    IconButton,
    ButtonGroup,
    ToggleButton,
    ToggleButtonGroup,
    SegmentedControl,
    Dialog,
    Slider,
    Switch,
    Card,
    Tooltip,
    Input,
    List,
    ListItem,
    ListSection,
    Select,
    Tabs
  } from '@custom-ereader/ui';

  let currentTheme = 'stone';
  let readingDirection = 'vertical';
  let pageMode = 'paginated';
  let fontSize = 18;
  let lineHeight = 1.8;
  let autoBookmark = true;
  let hideHeaderOnScroll = false;
  let selectedGoalFrequency = 'daily';
  let activeTabId = 'reader';

  let isDialogOpen = false;
  let isButtonLoading = false;
  let isMuted = false;

  let searchQuery = 'Kokoro';
  let customBookTitle = 'こころ (Kokoro)';
  let customPageMargin = 24;
  let validationErrorInput = 'invalid-sync-account';
  let selectedSourceId = 'gdrive';
  let listDensity: 'compact' | 'normal' | 'relaxed' = 'normal';
  let storageSourcesList = [
    {
      id: 'gdrive',
      name: 'Google Drive Sync',
      status: 'Connected • 1,240 books synced',
      active: true,
      type: 'cloud',
      error: false
    },
    {
      id: 'fs',
      name: 'Local FileSystem Storage',
      status: 'Syncing D:/Books/Japanese',
      active: false,
      type: 'local',
      error: false
    },
    {
      id: 'onedrive',
      name: 'Microsoft OneDrive',
      status: 'Session Expired • Reconnection required',
      active: false,
      type: 'cloud',
      error: true
    }
  ];

  let textAlign = 'left';
  let selectedPreset = 'sepia';
  let fontPreset = 'serif';
  let presets = [
    { id: 'default', text: 'Standard', style: { 'background-color': '#ffffff', color: '#18181b' } },
    {
      id: 'sepia',
      text: 'Sepia Paper',
      style: { 'background-color': '#f4ecd8', color: '#5b4636' },
      thickBorders: true,
      showIcons: true
    },
    {
      id: 'slate',
      text: 'Night Slate',
      style: { 'background-color': '#1e293b', color: '#f8fafc' },
      thickBorders: true,
      showIcons: true
    }
  ];
  let actionMessage = '';

  function handleEdit(e: CustomEvent<any>) {
    actionMessage = `Edit requested for preset: ${e.detail}`;
    setTimeout(() => (actionMessage = ''), 3000);
  }

  function handleDelete(e: CustomEvent<any>) {
    actionMessage = `Delete requested for preset: ${e.detail}`;
    setTimeout(() => (actionMessage = ''), 3000);
  }
</script>

<svelte:head>
  <title>Astryx UI Component Showcase · custom-ereader</title>
</svelte:head>

<div class="showcase-container" data-astryx-theme={currentTheme}>
  <header class="showcase-header">
    <div>
      <h1 class="showcase-title">Astryx Components Library</h1>
      <p class="showcase-subtitle">Designed for custom-ereader • Inspired by Meta Astryx</p>
    </div>

    <div class="theme-selector-wrap">
      <span class="theme-label">Active Theme:</span>
      <SegmentedControl
        size="sm"
        options={[
          { value: 'neutral', label: 'Neutral' },
          { value: 'stone', label: 'Stone (Reading)' },
          { value: 'gothic', label: 'Gothic (OLED)' }
        ]}
        bind:value={currentTheme}
      />
    </div>
  </header>

  <main class="showcase-grid">
    <!-- 1. Buttons & IconButtons -->
    <Card padding="lg" radius="lg">
      <h2 class="section-title">1. Buttons & IconButtons</h2>
      <p class="section-desc">
        Variants: primary, secondary, ghost, outline, danger with sizes and loading states.
      </p>

      <div class="demo-row">
        <Button variant="primary">Primary Action</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost Button</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="danger">Delete Book</Button>
      </div>

      <div class="demo-row">
        <Button
          variant="primary"
          size="sm"
          loading={isButtonLoading}
          on:click={() => {
            isButtonLoading = true;
            setTimeout(() => (isButtonLoading = false), 1500);
          }}
        >
          {isButtonLoading ? 'Loading...' : 'Click to Test Loading'}
        </Button>

        <Button variant="secondary" size="lg">Large Size</Button>
      </div>

      <div class="demo-row items-center">
        <span class="sub-label">Icon Buttons with Tooltips:</span>
        <Tooltip text="Bookmark Page (B)">
          <IconButton label="Bookmark" variant="subtle">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg
            >
          </IconButton>
        </Tooltip>

        <Tooltip text="Table of Contents (T)">
          <IconButton label="Table of Contents" variant="ghost">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" /><line
                x1="8"
                x2="21"
                y1="18"
                y2="18"
              /><line x1="3" x2="3.01" y1="6" y2="6" /><line
                x1="3"
                x2="3.01"
                y1="12"
                y2="12"
              /><line x1="3" x2="3.01" y1="18" y2="18" /></svg
            >
          </IconButton>
        </Tooltip>

        <Tooltip text="Search Dictionary (Ctrl+F)">
          <IconButton label="Search" variant="ghost">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg
            >
          </IconButton>
        </Tooltip>

        <Tooltip text="Open Fullscreen (F11)">
          <IconButton label="Fullscreen" variant="primary" shape="circle">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path
                d="M3 16v3a2 2 0 0 0 2 2h3"
              /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg
            >
          </IconButton>
        </Tooltip>
      </div>
    </Card>

    <!-- 2. SegmentedControl & ToggleButton -->
    <Card padding="lg" radius="lg">
      <h2 class="section-title">2. SegmentedControl & ToggleButton</h2>
      <p class="section-desc">Smooth tactile control for reader layout modes and settings.</p>

      <div class="control-group">
        <span class="group-label">Reading Direction:</span>
        <SegmentedControl
          options={[
            { value: 'vertical', label: '縦書き (Vertical)' },
            { value: 'horizontal', label: '横書き (Horizontal)' }
          ]}
          bind:value={readingDirection}
        />
      </div>

      <div class="control-group">
        <span class="group-label">Page Turn Mode:</span>
        <SegmentedControl
          options={[
            { value: 'paginated', label: 'Paginated' },
            { value: 'continuous', label: 'Continuous Scroll' }
          ]}
          bind:value={pageMode}
        />
      </div>

      <div class="control-group">
        <span class="group-label">Single Toggle Button:</span>
        <ToggleButton bind:pressed={isMuted}>
          {isMuted ? 'Muted' : 'Sound Enabled'}
        </ToggleButton>
      </div>
    </Card>

    <!-- 3. ButtonGroup & ToggleButtonGroup -->
    <Card padding="lg" radius="lg">
      <h2 class="section-title">3. ButtonGroup & ToggleButtonGroup</h2>
      <p class="section-desc">Unified connected button borders and custom theme option groups.</p>

      <div class="control-group">
        <span class="group-label">Attached Horizontal ButtonGroup:</span>
        <div class="demo-row">
          <ButtonGroup attached>
            <Button
              variant={textAlign === 'left' ? 'primary' : 'outline'}
              size="sm"
              on:click={() => (textAlign = 'left')}
            >
              Left
            </Button>
            <Button
              variant={textAlign === 'center' ? 'primary' : 'outline'}
              size="sm"
              on:click={() => (textAlign = 'center')}
            >
              Center
            </Button>
            <Button
              variant={textAlign === 'right' ? 'primary' : 'outline'}
              size="sm"
              on:click={() => (textAlign = 'right')}
            >
              Right
            </Button>
            <Button
              variant={textAlign === 'justify' ? 'primary' : 'outline'}
              size="sm"
              on:click={() => (textAlign = 'justify')}
            >
              Justify
            </Button>
          </ButtonGroup>

          <ButtonGroup attached>
            <IconButton label="Bold" variant="outline" size="sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M6 12h9a4 4 0 0 1 0 8H6v-8zm0-8h7a4 4 0 0 1 0 8H6V4z" /></svg
              >
            </IconButton>
            <IconButton label="Italic" variant="outline" size="sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><line x1="19" x2="10" y1="4" y2="4" /><line x1="14" x2="5" y1="20" y2="20" /><line
                  x1="15"
                  x2="9"
                  y1="4"
                  y2="20"
                /></svg
              >
            </IconButton>
            <IconButton label="Underline" variant="outline" size="sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" /><line
                  x1="4"
                  x2="20"
                  y1="21"
                  y2="21"
                /></svg
              >
            </IconButton>
          </ButtonGroup>
        </div>
      </div>

      <div class="control-group">
        <span class="group-label">Custom Reader Theme ToggleGroup (with styles & actions):</span>
        <ToggleButtonGroup
          options={presets}
          bind:selectedOptionId={selectedPreset}
          on:edit={handleEdit}
          on:delete={handleDelete}
        />
        {#if actionMessage}
          <div class="action-feedback">{actionMessage}</div>
        {/if}
      </div>

      <div class="control-group">
        <span class="group-label">Inverted Color Theme Options:</span>
        <ToggleButtonGroup
          invertColors={true}
          size="sm"
          options={[
            { id: 'sans', text: 'Sans-Serif (Gothic)' },
            { id: 'serif', text: 'Serif (Mincho)' },
            { id: 'mono', text: 'Monospace' }
          ]}
          bind:selectedOptionId={fontPreset}
        />
      </div>
    </Card>

    <!-- 4. Sliders -->
    <Card padding="lg" radius="lg">
      <h2 class="section-title">4. Sliders</h2>
      <p class="section-desc">
        Precise range inputs with smooth track fills for e-reader typography & navigation.
      </p>

      <div class="slider-stack">
        <Slider
          label="Font Size"
          min={12}
          max={36}
          step={1}
          bind:value={fontSize}
          valueFormatter={(v) => `${v}px`}
        />

        <Slider
          label="Line Height"
          min={1.2}
          max={2.5}
          step={0.1}
          bind:value={lineHeight}
          valueFormatter={(v) => `${v.toFixed(1)}x`}
        />

        <div class="live-preview" style="font-size: {fontSize}px; line-height: {lineHeight};">
          吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。
        </div>
      </div>
    </Card>

    <!-- 5. Switch & Dialog -->
    <Card padding="lg" radius="lg">
      <h2 class="section-title">5. Switch & Dialog</h2>
      <p class="section-desc">Accessible switches and refined Astryx surface modals.</p>

      <div class="switch-stack">
        <Switch
          label="Auto-Bookmark on page turn"
          description="Automatically sync bookmark position to cloud storage"
          bind:checked={autoBookmark}
        />

        <Switch
          label="Hide Header on Scroll"
          description="Maximize reading area during continuous reading"
          bind:checked={hideHeaderOnScroll}
        />
      </div>

      <div style="margin-top: 20px;">
        <Button variant="primary" on:click={() => (isDialogOpen = true)}>
          Open Astryx Dialog Modal
        </Button>
      </div>
    </Card>

    <!-- 6. Inputs & TextFields -->
    <Card padding="lg" radius="lg">
      <h2 class="section-title">6. Inputs & TextFields</h2>
      <p class="section-desc">
        Versatile input fields with icons, clear buttons, size scale, and validation feedback.
      </p>

      <div class="input-stack">
        <!-- Search Input with Leading Icon & Clear Button -->
        <Input
          label="Search Library"
          placeholder="Filter by title, author, or tag..."
          clearable={true}
          bind:value={searchQuery}
        >
          <span slot="prefix">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg
            >
          </span>
        </Input>

        <!-- Number Input with Trailing Unit Suffix & sm size -->
        <div class="demo-grid-2">
          <Input
            label="Page Margin"
            type="number"
            min="0"
            max="100"
            bind:value={customPageMargin}
            helperText="Default margin for reader view"
          >
            <span slot="suffix" class="input-unit">px</span>
          </Input>

          <Input
            label="Small Size (sm)"
            size="sm"
            placeholder="Small input"
            value="Compact value"
          />
        </div>

        <!-- Underline Variant -->
        <Input
          label="Book Title (Underline Minimal Variant)"
          variant="underline"
          placeholder="Enter book title"
          bind:value={customBookTitle}
          helperText="Underline style optimized for minimal dialogs and reading panels"
        />

        <!-- Error State with message -->
        <Input
          label="Sync Account Email (Validation State)"
          placeholder="user@example.com"
          bind:value={validationErrorInput}
          error="Please provide a valid authenticated email address"
        />
      </div>
    </Card>

    <!-- 7. Lists & ListItems -->
    <Card padding="lg" radius="lg">
      <h2 class="section-title">7. Lists & ListItems</h2>
      <p class="section-desc">
        Structured list items with icons, descriptions, trailing actions, and card/plain variants.
      </p>

      <div class="control-group">
        <div class="density-bar">
          <span class="group-label">List Density:</span>
          <SegmentedControl
            size="sm"
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'normal', label: 'Normal' },
              { value: 'relaxed', label: 'Relaxed' }
            ]}
            bind:value={listDensity}
          />
        </div>

        <!-- Card-style List with prefix icons, badges, switches, and selection -->
        <List variant="card" divided={true} density={listDensity}>
          {#each storageSourcesList as source (source.id)}
            <ListItem
              headline={source.name}
              description={source.status}
              clickable={true}
              selected={selectedSourceId === source.id}
              on:click={() => (selectedSourceId = source.id)}
            >
              <svelte:fragment slot="prefix">
                {#if source.type === 'cloud'}
                  <div class="source-icon-wrap" class:is-error={source.error}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></svg
                    >
                  </div>
                {:else}
                  <div class="source-icon-wrap">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><path
                        d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"
                      /></svg
                    >
                  </div>
                {/if}
              </svelte:fragment>

              <svelte:fragment slot="suffix">
                {#if source.error}
                  <span class="badge-tag is-error">Expired</span>
                {:else if source.active}
                  <span class="badge-tag is-active">Active</span>
                {:else}
                  <span class="badge-tag">Ready</span>
                {/if}
              </svelte:fragment>
            </ListItem>
          {/each}
        </List>
      </div>

      <div class="control-group" style="margin-top: 20px;">
        <span class="group-label">Plain Action List with Chevrons:</span>
        <List variant="bordered" divided={true}>
          <ListItem
            headline="Configure Japanese Dictionaries"
            description="Manage Yomichan / Yomitan, JMdict, and EPWING files"
            clickable={true}
          >
            <svelte:fragment slot="prefix">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" /></svg
              >
            </svelte:fragment>
            <svelte:fragment slot="suffix">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg
              >
            </svelte:fragment>
          </ListItem>

          <ListItem
            headline="Typography & Custom Web Fonts"
            description="Add OTF, TTF, and WOFF2 local Japanese typefaces"
            clickable={true}
          >
            <svelte:fragment slot="prefix">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" x2="15" y1="20" y2="20" /><line
                  x1="12"
                  x2="12"
                  y1="4"
                  y2="20"
                /></svg
              >
            </svelte:fragment>
            <svelte:fragment slot="suffix">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg
              >
            </svelte:fragment>
          </ListItem>
        </List>
      </div>
    </Card>

    <!-- 8. Select & Dropdowns -->
    <Card padding="lg" radius="lg">
      <h2 class="section-title">8. Select & Dropdowns</h2>
      <p class="section-desc">
        Semantic dropdown selects with Astryx styling, chevron indicator, and theme tokens.
      </p>

      <div class="demo-grid-2">
        <Select
          label="Reading Goal Frequency"
          helperText="Determines the target cycle for statistics"
          bind:value={selectedGoalFrequency}
          options={[
            { value: 'daily', label: 'Daily (1 Day)' },
            { value: 'weekly', label: 'Weekly (7 Days)' },
            { value: 'monthly', label: 'Monthly (30 Days)' }
          ]}
        />

        <Select
          label="Font Family Preset"
          placeholder="Choose font preset..."
          value="noto-serif"
          options={[
            { value: 'noto-serif', label: 'Noto Serif JP' },
            { value: 'shippori', label: 'Shippori Mincho' },
            { value: 'klee', label: 'Klee One SemiBold' },
            { value: 'noto-sans', label: 'Noto Sans JP' }
          ]}
        />
      </div>
    </Card>

    <!-- 9. Tabs & Grouped Settings ListSections -->
    <Card padding="lg" radius="lg">
      <h2 class="section-title">9. Tabs & Grouped Settings ListSections</h2>
      <p class="section-desc">
        Cohesive navigation tabs and card-grouped settings lists with stacked layouts and multi-line
        descriptions.
      </p>

      <div class="control-group">
        <span class="group-label">Navigation Tabs:</span>
        <Tabs
          fullWidth={true}
          bind:activeId={activeTabId}
          items={[
            { id: 'reader', label: 'Reader', badge: '12' },
            { id: 'data', label: 'Data & Sync' },
            { id: 'statistics', label: 'Statistics' }
          ]}
        />
      </div>

      <div style="margin-top: 24px;">
        <ListSection
          title="Reader Settings Preview"
          description="Example of modern grouped settings card with Switch and Slider rows"
        >
          <ListItem
            headline="Auto-Bookmark on Reading Pause"
            description="Automatically captures current reading position after a brief pause without user interaction"
          >
            <Switch slot="suffix" bind:checked={autoBookmark} />
          </ListItem>

          <ListItem
            layout="stacked"
            headline="Font Size"
            description="Adjusts primary Japanese and CJK typography scale across continuous and paginated views"
          >
            <span slot="suffix" class="badge-tag">{fontSize}px</span>
            <Slider min={12} max={36} bind:value={fontSize} showValue={false} />
          </ListItem>

          <ListItem
            layout="stacked"
            headline="Writing Direction"
            description="Controls text orientation and column progression flow"
          >
            <SegmentedControl
              fullWidth={true}
              size="sm"
              options={[
                { value: 'vertical', label: '縦書き (Vertical)' },
                { value: 'horizontal', label: '横書き (Horizontal)' }
              ]}
              bind:value={readingDirection}
            />
          </ListItem>
        </ListSection>
      </div>
    </Card>
  </main>

  <!-- Astryx Dialog Instance -->
  <Dialog
    bind:open={isDialogOpen}
    title="Reader Preferences"
    description="Customize how books and dictionaries appear while reading."
    size="md"
  >
    <div class="dialog-content-stack">
      <p>
        Astryx surface dialogs feature backdrop blur, smooth scale-in animations, accessible Escape
        key dismissal, and clear action hierarchies.
      </p>

      <div class="dialog-setting">
        <Switch label="Enable Yomichan / Yomitan popup lookup" checked={true} />
      </div>

      <div class="dialog-setting">
        <Slider
          label="Dictionary Popup Font Size"
          min={10}
          max={24}
          value={14}
          valueFormatter={(v) => `${v}px`}
        />
      </div>
    </div>

    <svelte:fragment slot="footer">
      <Button variant="ghost" on:click={() => (isDialogOpen = false)}>Cancel</Button>
      <Button variant="primary" on:click={() => (isDialogOpen = false)}>Save Preferences</Button>
    </svelte:fragment>
  </Dialog>
</div>

<style>
  .showcase-container {
    min-height: 100vh;
    padding: var(--astryx-space-6, 24px) var(--astryx-space-8, 32px);
    background-color: var(--astryx-color-canvas, #fafafa);
    color: var(--astryx-color-fg-primary, #18181b);
    font-family: var(--astryx-font-family-sans, sans-serif);
    transition:
      background-color var(--astryx-duration-slow, 300ms) ease,
      color var(--astryx-duration-slow, 300ms) ease;
  }

  .showcase-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1100px;
    margin: 0 auto var(--astryx-space-8, 32px) auto;
    padding-bottom: var(--astryx-space-5, 20px);
    border-bottom: 1px solid var(--astryx-color-border-default, #e4e4e7);
    flex-wrap: wrap;
    gap: var(--astryx-space-4, 16px);
  }

  .showcase-title {
    margin: 0;
    font-size: var(--astryx-font-size-2xl, 1.5rem);
    font-weight: var(--astryx-font-weight-bold, 700);
    letter-spacing: -0.02em;
  }

  .showcase-subtitle {
    margin: var(--astryx-space-1, 4px) 0 0 0;
    font-size: var(--astryx-font-size-sm, 0.875rem);
    color: var(--astryx-color-fg-secondary, #71717a);
  }

  .theme-selector-wrap {
    display: flex;
    align-items: center;
    gap: var(--astryx-space-3, 12px);
  }

  .theme-label {
    font-size: var(--astryx-font-size-sm, 0.875rem);
    font-weight: var(--astryx-font-weight-medium, 500);
    color: var(--astryx-color-fg-secondary, #52525b);
  }

  .showcase-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
    gap: var(--astryx-space-6, 24px);
    max-width: 1100px;
    margin: 0 auto;
  }

  .section-title {
    margin: 0;
    font-size: var(--astryx-font-size-md, 1rem);
    font-weight: var(--astryx-font-weight-semibold, 600);
  }

  .section-desc {
    margin: var(--astryx-space-1, 4px) 0 var(--astryx-space-4, 16px) 0;
    font-size: var(--astryx-font-size-xs, 0.75rem);
    color: var(--astryx-color-fg-secondary, #71717a);
  }

  .demo-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--astryx-space-2-5, 10px);
    margin-bottom: var(--astryx-space-3, 12px);
  }

  .sub-label {
    font-size: var(--astryx-font-size-xs, 0.75rem);
    color: var(--astryx-color-fg-muted, #71717a);
    margin-right: var(--astryx-space-2, 8px);
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: var(--astryx-space-1-5, 6px);
    margin-bottom: var(--astryx-space-4, 16px);
  }

  .action-feedback {
    margin-top: var(--astryx-space-2, 8px);
    font-size: var(--astryx-font-size-xs, 0.75rem);
    color: var(--astryx-color-brand, #18181b);
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    padding: var(--astryx-space-1, 4px) var(--astryx-space-2-5, 10px);
    border-radius: var(--astryx-radius-sm, 4px);
    border-left: 3px solid var(--astryx-color-accent, #0284c7);
  }

  .group-label {
    font-size: var(--astryx-font-size-sm, 0.875rem);
    font-weight: var(--astryx-font-weight-medium, 500);
    color: var(--astryx-color-fg-secondary, #52525b);
  }

  .slider-stack {
    display: flex;
    flex-direction: column;
    gap: var(--astryx-space-4, 16px);
  }

  .live-preview {
    margin-top: var(--astryx-space-2, 8px);
    padding: var(--astryx-space-3, 12px);
    border-radius: var(--astryx-radius-md, 6px);
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    border: 1px dashed var(--astryx-color-border-default, #e4e4e7);
    color: var(--astryx-color-fg-primary, #18181b);
    transition:
      font-size 100ms ease,
      line-height 100ms ease;
  }

  .switch-stack {
    display: flex;
    flex-direction: column;
    gap: var(--astryx-space-4, 16px);
  }

  .dialog-content-stack {
    display: flex;
    flex-direction: column;
    gap: var(--astryx-space-4, 16px);
  }

  .dialog-setting {
    padding-top: var(--astryx-space-3, 12px);
    border-top: 1px solid var(--astryx-color-border-subtle, #f4f4f5);
  }

  .input-stack {
    display: flex;
    flex-direction: column;
    gap: var(--astryx-space-4, 16px);
  }

  .demo-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--astryx-space-3, 12px);
  }

  .input-unit {
    font-size: var(--astryx-font-size-xs, 0.75rem);
    color: var(--astryx-color-fg-muted, #71717a);
    font-weight: var(--astryx-font-weight-medium, 500);
  }

  .density-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--astryx-space-2, 8px);
  }

  .source-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--astryx-radius-md, 6px);
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    color: var(--astryx-color-fg-secondary, #52525b);
  }
  .source-icon-wrap.is-error {
    background-color: var(--astryx-color-danger-subtle, #fee2e2);
    color: var(--astryx-color-danger, #ef4444);
  }

  .badge-tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: var(--astryx-radius-full, 9999px);
    font-size: var(--astryx-font-size-xs, 0.75rem);
    font-weight: var(--astryx-font-weight-medium, 500);
    background-color: var(--astryx-color-surface-subtle, #f4f4f5);
    color: var(--astryx-color-fg-secondary, #52525b);
  }
  .badge-tag.is-active {
    background-color: #dcfce7;
    color: #166534;
  }
  .badge-tag.is-error {
    background-color: var(--astryx-color-danger-subtle, #fee2e2);
    color: var(--astryx-color-danger, #ef4444);
  }
</style>
