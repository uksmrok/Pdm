# PDM Training Calculator — GitHub Pages build

**Training/simulation only; NOT for aviation operations.** This package deliberately excludes the source PDF; publishing a GitHub repository can make every included file publicly accessible.

## Publish to GitHub Pages

1. Create a new GitHub repository, e.g. `pdm-calculator`.
2. Add the **contents of this ZIP** to the root of its `main` branch. Keep the `assets` directory and its two PNG files in place. Do not upload the ZIP as a single file.
3. In the repository go to Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save.
4. Wait for GitHub Pages deployment, then open `https://YOUR-USERNAME.github.io/pdm-calculator/` in iPhone Safari.
5. Tap Share → Add to Home Screen, and open it once while online for offline caching.

The app uses relative paths suitable for a GitHub Pages repository subpath. It has no backend, no external CDN calls, and no published copies of the original PDF.

Coverage: ISA Table 1-1, reference speeds with user-provided chart inputs, illustrative wind and runway lookups, engine references, fuel arithmetic, and constant-rate climb/descent exercises. Aircraft-specific chart performance is NOT implemented or certified. No real-world takeoff or landing planning should rely on it.
