// Theme variables from the last visit, until theme-style.svelte takes over.
try {
  var cached = JSON.parse(localStorage.getItem('themeCssCache') || 'null');
  if (cached) {
    document.documentElement.style.cssText += cached.vars;
    document.documentElement.classList.toggle('theme-dark', cached.dark);
  }
} catch (e) {}
