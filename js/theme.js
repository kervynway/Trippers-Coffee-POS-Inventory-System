(() => {
  "use strict";

  const STORAGE_KEY = "trippersTheme";
  const root = document.documentElement;

  function storedTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }

  function setTheme(theme, persist = true) {
    const next = theme === "light" ? "light" : "dark";
    root.dataset.theme = next;
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Continue without storage. */ }
    }
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const isLight = next === "light";
      button.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
      button.setAttribute("title", isLight ? "Switch to dark mode" : "Switch to light mode");
      button.setAttribute("aria-pressed", String(isLight));
      button.dataset.themeState = next;
      const label = button.querySelector("[data-theme-label]");
      const icon = button.querySelector("[data-theme-icon]");
      if (label) label.textContent = isLight ? "Dark" : "Light";
      if (icon) icon.textContent = isLight ? "☾" : "☼";
    });
  }

  const defaultTheme = "dark";
  const initial = storedTheme() || defaultTheme;
  setTheme(initial, false);

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => button.addEventListener("click", () => {
      setTheme(root.dataset.theme === "light" ? "dark" : "light");
    }));
  });

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY && event.newValue) setTheme(event.newValue, false);
  });
})();
