<script lang="ts">
  import { browser } from '$app/environment';
  import { activeTheme$ } from '$lib/data/theme/theme-store';
  import { themeTokens } from '$lib/data/theme/theme-tokens';
  import type { ResolvedTheme } from '$lib/data/theme/themes';

  const customCssId = 'ttu-theme-custom-css';
  /** Read by the inline script in app.html to avoid a flash of the default colours. */
  const cacheKey = 'themeCssCache';

  $: if (browser && $activeTheme$) {
    applyTheme($activeTheme$);
  }

  function applyTheme(theme: ResolvedTheme) {
    const root = document.documentElement;

    themeTokens.forEach(({ token, cssVar }) => root.style.setProperty(cssVar, theme.colors[token]));
    root.style.setProperty('--app-radius-scale', String(theme.radius));
    root.style.setProperty('--app-blur', `${theme.blur}px`);

    if (theme.uiFont) {
      root.style.setProperty('--app-ui-font', theme.uiFont);
    } else {
      root.style.removeProperty('--app-ui-font');
    }

    root.style.colorScheme = theme.dark ? 'dark' : 'light';
    root.classList.toggle('theme-dark', theme.dark);
    root.dataset.theme = theme.id;

    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          dark: theme.dark,
          vars: Array.from(root.style)
            .filter((name) => name.startsWith('--') || name === 'color-scheme')
            .map((name) => `${name}:${root.style.getPropertyValue(name)};`)
            .join('')
        })
      );
    } catch (_) {
      // storage full or unavailable
    }

    let style = document.getElementById(customCssId);

    if (!theme.customCss) {
      style?.remove();
      return;
    }

    if (!style) {
      style = document.createElement('style');
      style.id = customCssId;
      document.head.append(style);
    }

    style.textContent = theme.customCss;
  }
</script>
