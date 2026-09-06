# @custom-ereader/ui

Astryx-inspired component library designed for [custom-ereader](https://github.com/valpr/custom-ereader), based on [Meta Astryx Design System](https://astryx.atmeta.com/docs/getting-started).

## ✨ Features

- **Astryx Design Foundations**: Clean, calm, accessible UI with semantic design tokens (colors, radii, spacing, elevations, motion).
- **Themes for E-Reading**:
  - `neutral`: Clean, modern monochrome theme (default)
  - `stone`: Warm paper & sandstone tones, easy on the eyes for extended reading
  - `gothic`: High-contrast deep noir & true black for OLED/midnight reading
- **Svelte Native**: First-class Svelte components with scoped styling and zero bundle overhead.
- **Tailwind Interop**: Uses Astryx CSS variables under the hood with open `class` prop passthrough for optional Tailwind utilities.

## 📦 Components

1. **Button & IconButton**: Primary, secondary, ghost, outline, and danger variants with loading states, sizes (`sm`, `md`, `lg`), and prefix/suffix slots.
2. **SegmentedControl & ToggleButton**: Smooth segmented switchers for reading modes (Horizontal / Vertical, Paginated / Continuous).
3. **Dialog**: Accessible modal surface with backdrop blur, title, subtitle, custom body, and action footer.
4. **Slider**: Range slider with interactive track fill, thumb, and value formatting for font size, brightness, and reading progress.
5. **Switch**: Accessible pill toggle switch with smooth spring animations.
6. **Card**: Surface container with elevation, padding, radius, and interactive hover states for book cards and settings panels.
7. **Tooltip**: Floating hover hints with directional arrows for reader toolbar actions.

## 🚀 Getting Started

### 1. Import Styles

In your global stylesheet (e.g. `apps/web/src/app.css`):

```css
@import '@custom-ereader/ui/styles';
```

### 2. Set Theme

Set the theme on any container or `<html>`:

```html
<div data-astryx-theme="stone">
  <!-- Warm sandstone e-reading experience -->
</div>
```

### 3. Use Components

```svelte
<script>
  import { Button, SegmentedControl, Slider, Switch, Dialog } from '@custom-ereader/ui';

  let readingMode = 'paginated';
  let fontSize = 18;
  let autoBookmark = true;
  let isDialogOpen = false;
</script>

<SegmentedControl options={['paginated', 'continuous']} bind:value={readingMode} />

<Slider
  label="Font Size"
  min={12}
  max={36}
  step={1}
  bind:value={fontSize}
  valueFormatter={(v) => `${v}px`}
/>

<Switch label="Auto-bookmark on page turn" bind:checked={autoBookmark} />

<Button variant="primary" on:click={() => (isDialogOpen = true)}>Settings</Button>

<Dialog bind:open={isDialogOpen} title="Reader Settings">
  <p>Customize your reading display.</p>
</Dialog>
```
