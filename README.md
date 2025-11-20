# PopupHelperWP

Lightweight, dependency-free popup for WordPress. Ships with a simple content system (JSON files in `assets/content`) and a JS configuration layer so you can run it on any page without touching PHP templates.

> Version: 0.1.0 · License: MIT · Text domain: `relohelper-popup`

## Features

- Vanilla JS + CSS, no jQuery
- Per-page triggers and fallback content
- Session and cool-down limits
- Telegram and WhatsApp action buttons
- Cache-busting via file modification time
- Ready for translation (i18n)

## Installation

1. Copy the `relohelper-popup` folder to `wp-content/plugins/`.
2. Activate **ReloHelper Popup** in the WordPress admin.
3. The plugin automatically enqueues assets on the front end. No shortcodes required.

## Configuration

All runtime options live in `assets/js/config.js`:

- Global links like `telegramUrl` and `whatsappUrl`
- Limits: `perSession`, `afterCloseDays`, `afterClickDays`
- UI tweaks: `buttonMinHeightPx`, `uppercaseButtons`, and so on
- Per-page rules in the `pages` array: set `match` with a path, choose `contentFile`, and provide `fallbackContent`

> Keep sensible defaults for GitHub. If you deploy to a single site, you can change the values in-place. Add a short inline comment near any site-specific value that mentions how to override it later.

### Content files

JSON files in `assets/content/` define the text used inside the popup. See the existing examples (`home_es.json`, `no_lucrativa.json`, etc). You can also ship a `.txt` file next to each JSON as a human-readable reference.

## Development

- PHP 7.4+ and WordPress 5.8+
- No build step required
- Lint with `php -l` or your editor

## Uninstall

This plugin does not store options in the database. If you ever add options, create `uninstall.php` and delete them there.

## Folder structure

```
relohelper-popup/
  assets/
    content/
    css/
    img/
    js/
  utils/
  relohelper-popup.php
  LICENSE
  .gitignore
  .gitattributes
  README.md
```

## Security

The plugin does not process user input. If you expand features to accept input or AJAX, validate and sanitize everything.
