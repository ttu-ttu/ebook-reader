# Themes

Themes colour the whole app: the library, settings, statistics, the reader
header and panels, and the book page itself. This guide covers the built-in
themes, the theme editor, the JSON format for sharing themes, and custom CSS.

## Picking a theme

- **Settings → Themes** shows every theme with a preview. Click a preview to use it.
- **Settings → Reader → Theme** and the palette icon in the reader header switch
  themes quickly.

Built-in themes:

| Id | Name | Kind |
| --- | --- | --- |
| `washi-theme` | Washi | light, warm paper and vermilion (default) |
| `washi-dark-theme` | Sumi | dark, ink and vermilion (default dark) |
| `light-theme` | Light | light |
| `ecru-theme` | Ecru | light, warm paper |
| `water-theme` | Water | light, pale blue page |
| `gray-theme` | Gray | dark |
| `dark-theme` | Dark | dark, dimmed text |
| `black-theme` | Black | dark, pure black (OLED) |
| `sepia-theme` | Sepia | light, brown text on cream |
| `sakura-theme` | Sakura | light, pink accents |
| `nord-theme` | Nord | dark, blue-grey |
| `solarized-dark-theme` | Solarized Dark | dark |

`light-theme` to `black-theme` keep the ids of upstream ッツ Reader's reader themes, so a theme
chosen before this update stays selected. Custom reader themes made with the old
"custom theme" dialog are converted once into full themes.

Themes are stored in the browser's local storage, like the other settings, so
each browser has its own list. Export a theme to move it to another browser.

## Making a theme in the editor

1. Go to **Settings → Themes**.
2. Click **New theme**, which starts from the theme you are using, or the **+**
   on any theme card to duplicate that theme.
3. Change what you like. Every change shows live across the whole app, so you can
   switch to the library or open a book in another tab to check it.
4. Click **Save**. The theme is selected and gets **Edit**, **Delete** and the
   other buttons on its card.

In the editor:

- **Based on**: the theme this one starts from. Every colour you don't set is
  inherited from it, so a theme can be as small as one changed accent colour.
  If you later change the base theme, themes based on it change too.
- **Dark theme**: tells the browser to use dark scrollbars, form controls and
  date pickers. Inherited from the base if left at "Same as base".
- **Roundness**: scales the corner radius of cards, popovers, the header and
  buttons (0 is square, 1 is the default, 2 is very round).
- **Glass blur**: the blur behind the translucent header, sidebar and popovers,
  in pixels. 0 turns the glass effect off. This is useful on slow devices.
- **Interface font**: a CSS font family for the app's interface, e.g.
  `'Zen Maru Gothic', sans-serif`. The book's own fonts are set in
  Settings → Reader. The font must be installed or added as a user font.
- **Colours**: one row per colour. Click the swatch to pick a colour, use the
  slider for opacity, or type any CSS colour in the text field. The ↺ button
  removes your value so the colour is inherited again. The placeholder text
  shows the inherited value.
- **Custom CSS**: extra CSS added after the theme's variables. See
  [Custom CSS](#custom-css).

## Colours

Every colour accepts anything CSS understands as a colour:

- `#1e293b`, `#1e293bcc` (with alpha)
- `rgb(30 41 59)`, `rgba(30, 41, 59, 0.8)`
- `hsl(220 30% 20%)`, `oklch(0.7 0.1 200)`
- `color-mix(in srgb, #0f766e 40%, white)`
- names such as `rebeccapurple`

Colours added later (subtle text, accent hover, focus ring, switches, progress,
cover shadow, difficulty and heatmap) default to mixes of the older ones, such as
`var(--accent-color)`, so a theme made before them only needs them if you want
something different. You can use those `var(--…)` references in your own values too.

The editor warns when text, muted text or text on the accent falls below WCAG AA
contrast (4.5:1); built-in themes are checked by `themes.test.ts`.

### App

| Key | CSS variable | Used for |
| --- | --- | --- |
| `background` | `--background-color` | Page background of the library, settings and statistics |
| `surface` | `--surface-color` | Cards and panels (bottom of their gradient) |
| `surfaceStrong` | `--surface-strong-color` | Cards and panels (top of their gradient), popovers, dialogs |
| `text` | `--font-color` | Main text colour |
| `mutedText` | `--app-muted-fg` | Secondary text such as hints and counts |
| `subtleText` | `--app-text-subtle` | Least important text: placeholders, counts on inactive filters |
| `border` | `--border-color` | Card and divider borders |
| `shadow` | `--shadow-color` | Drop shadows |
| `insetHighlight` | `--app-inset-highlight` | The thin light line along the top edge of cards |
| `accent` | `--accent-color` | Active items, progress bars, focus rings |
| `accentStrong` | `--accent-strong-color` | Accent used for text and icons |
| `accentHover` | `--app-accent-hover` | Accent buttons and links under the pointer |
| `accentText` | `--app-accent-fg` | Text placed on an accent background |
| `control` | `--app-control-bg` | Inputs, tabs and buttons |
| `focusRing` | `--app-focus-ring` | Outline around the focused control when using the keyboard |
| `controlBorder` | `--app-control-border` | Borders of inputs, tabs and buttons |
| `danger` | `--app-danger-color` | Delete actions and errors |
| `overlay` | `--app-overlay-color` | Dims the page behind dialogs |
| `scrollbar` | `--app-scrollbar-color` | Scrollbar thumb |

### States

| Key | CSS variable | Used for |
| --- | --- | --- |
| `success` | `--app-success-color` | Synced, saved and other good states |
| `warning` | `--app-warning-color` | Pending sync and other states that need attention |
| `toggleOn` | `--app-toggle-on` | Track of a switch that is on |
| `toggleOff` | `--app-toggle-off` | Track of a switch that is off |
| `progressTrack` | `--app-progress-track` | Empty part of progress bars |
| `progressFill` | `--app-progress-fill` | Filled part of progress bars |
| `coverShadow` | `--app-cover-shadow` | Shadow under book covers |

### Data

| Key | CSS variable | Used for |
| --- | --- | --- |
| `difficulty1` | `--difficulty-1` | Beginner |
| `difficulty2` | `--difficulty-2` | Easy |
| `difficulty3` | `--difficulty-3` | Average |
| `difficulty4` | `--difficulty-4` | Hard |
| `difficulty5` | `--difficulty-5` | Expert and above |
| `heatmapEmpty` | `--heatmap-empty` | Days without reading |
| `heatmapLow` | `--heatmap-low` | Days with the least reading; other days blend towards the next colour |
| `heatmapHigh` | `--heatmap-high` | Days with the most reading |

### Header

| Key | CSS variable | Used for |
| --- | --- | --- |
| `headerBackground` | `--app-header-bg` | Top bar and library sidebar (glass, keep it slightly transparent) |
| `headerText` | `--app-header-fg` | Titles in the top bar |
| `headerBorder` | `--app-header-border` | Line below the top bar |
| `headerIcon` | `--app-header-icon-fg` | Icon buttons |
| `headerIconBackground` | `--app-header-icon-bg` | Pill behind grouped icon buttons |
| `headerIconBorder` | `--app-header-icon-border` | Outline of the icon pill |
| `headerIconHover` | `--app-header-icon-hover-bg` | Icon button hover and active state |

### Reader

| Key | CSS variable | Used for |
| --- | --- | --- |
| `readerText` | `--reader-text-color` | Text of the book |
| `readerBackground` | `--reader-background-color` | Page colour while reading |
| `selectionText` | `--reader-selection-color` | Selected text in the book |
| `selectionBackground` | `--reader-selection-bg` | Background of selected text |
| `furiganaHintText` | `--reader-furigana-hint-color` | Furigana when the "partial" furigana style is on |
| `furiganaHintShadow` | `--reader-furigana-shadow-color` | Shadow that hides furigana until hovered |
| `footerText` | `--reader-footer-color` | Progress and character counter at the bottom |
| `panelBackground` | `--reader-panel-bg` | Read aloud player, Ask AI, search, notes and the selection toolbar |
| `panelText` | `--reader-panel-fg` | Text in those panels |

### Annotations

| Key | CSS variable | Used for |
| --- | --- | --- |
| `highlightYellow` | `--highlight-yellow` | First highlight colour |
| `highlightGreen` | `--highlight-green` | Second highlight colour |
| `highlightBlue` | `--highlight-blue` | Third highlight colour |
| `highlightPink` | `--highlight-pink` | Fourth highlight colour |
| `searchMatch` | `--search-match-color` | The search result you jumped to |
| `readingLine` | `--reading-line-color` | What the audiobook or AI voice is reading |

- Highlight colours sit on top of the book text, so give them roughly 30–45%
  opacity. Fully opaque highlights hide the text.
- Keep `readerText` and `readerBackground` at a comfortable contrast. Very
  high contrast, such as pure white on pure black, tires the eyes over long
  sessions. `dark-theme` uses 60% white text for this reason.
- `panelBackground` is used for overlays on top of the book, such as read
  aloud, Ask AI, search, highlights and the selection toolbar. A dark panel
  works on both light and dark pages.

## JSON format

Themes are shared as JSON. Use **Download** or **Copy JSON** on a theme card to
export one, and **Import** to add one, either by pasting JSON or choosing a
`.json` file.

```json
{
  "$format": 1,
  "id": "midnight-theme",
  "name": "Midnight",
  "extends": "dark",
  "dark": true,
  "radius": 1.2,
  "blur": 16,
  "uiFont": "'Noto Sans JP', sans-serif",
  "colors": {
    "background": "#0b1020",
    "surface": "rgba(20, 28, 52, 0.82)",
    "surfaceStrong": "rgba(26, 36, 66, 0.96)",
    "accent": "#7c9cff",
    "accentStrong": "#a5b8ff",
    "accentText": "#0b1020",
    "readerBackground": "#0e1428",
    "readerText": "rgba(226, 232, 255, 0.82)",
    "highlightYellow": "rgba(255, 214, 102, 0.32)"
  },
  "customCss": ".app-surface-card { border-width: 2px; }"
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | yes | Name shown in the app. |
| `id` | no | Lowercase letters, digits and dashes. Generated from the name if missing; made unique on import (e.g. `midnight-2-theme`). |
| `extends` | no | Id of the theme to start from: `light`, `dark` (the plain bases), a built-in id, or another custom theme's id. Defaults to `light`, or `dark` when `"dark": true`. |
| `dark` | no | `true` for a dark theme (native controls, scrollbars). Inherited when missing. |
| `colors` | no | Any of the colour keys above. Unknown keys and invalid colours are rejected on import, with a message saying which one. |
| `radius` | no | Corner roundness, 0–3 (1 = default). |
| `blur` | no | Glass blur in px, 0–64 (default 24). |
| `uiFont` | no | CSS font family for the interface. |
| `customCss` | no | Extra CSS, see below. The custom CSS of the base theme is applied first. |
| `$format` | no | Format version written on export, currently 1. |

A theme that extends a custom theme only works where that theme exists too, so
either share both or use a built-in theme as the base. If a base can't be found,
the theme falls back to Light.

The smallest useful theme changes a single colour:

```json
{ "name": "Light, purple", "extends": "light-theme", "colors": { "accent": "#7c3aed" } }
```

## Custom CSS

`customCss` (or the Custom CSS box in the editor) is added as a `<style>`
element after the theme's variables, so it can override anything. The theme's
colours are available as CSS variables (see the tables above), along with:

| Variable | Meaning |
| --- | --- |
| `--app-radius-scale` | The roundness setting, as a number |
| `--app-blur` | The glass blur setting, e.g. `24px` |
| `--app-ui-font` | The interface font, if set |

Useful selectors:

| Selector | What it is |
| --- | --- |
| `html.theme-dark` | Present while a dark theme is active |
| `html[data-theme="my-theme"]` | The active theme's id |
| `.app-header-surface` | The top bar |
| `.app-surface-card` | Cards (settings groups, toolbars, the continue-reading shelf) |
| `.app-popover-panel`, `.app-popover-item` | Menus |
| `.library-card`, `.library-list-row` | Books in the library (cover and list views) |
| `.book-content` | The book text in the reader |
| `.reader-panel` | Overlay panels in the reader |
| `::highlight(ttu-hl-yellow)` (`-green`, `-blue`, `-pink`) | Highlighted text |
| `::highlight(ttu-hl-note)` | Highlights that have a note (dotted underline by default) |
| `::highlight(ttu-search)` | The search result you jumped to |

Examples:

```css
/* Notes: a solid underline instead of a dotted one */
::highlight(ttu-hl-note) {
  text-decoration: underline solid;
  text-decoration-thickness: 2px;
}

/* No drop shadows anywhere */
.app-surface-card,
.app-popover-panel {
  box-shadow: none !important;
}

/* Slightly wider letter spacing in books, only for this theme */
.book-content {
  letter-spacing: 0.03em;
}
```

Book styles from the EPUB itself can override colours unless "Prioritize reader
styles" is on in Settings → Reader.

## Where theme values come from

- `apps/web/src/lib/data/theme/theme-tokens.ts` lists every colour, with its CSS
  variable and description. The editor and the tables above follow it.
- `apps/web/src/lib/data/theme/themes.ts` has the built-in themes, inheritance
  (`resolveTheme`) and import validation (`parseThemeDefinition`).
- `apps/web/src/lib/components/theme/theme-style.svelte` writes the active theme
  to `<html>` as CSS variables.

To add a built-in theme, add an entry to `builtInThemes` in `themes.ts`. Use
`extends` and only list the colours that differ.
