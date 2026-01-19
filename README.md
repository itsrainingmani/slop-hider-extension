# GitHub Bot Comment Collapser

A browser extension that automatically collapses comments from bots on GitHub PRs and issues.

## Features

- Automatically detects and collapses bot comments
- Minimal UI - just a colored left border indicator
- Click GitHub's native header to expand/collapse
- Blue border = comment, Purple border = review
- Sidebar widget for bulk expand/collapse
- Supports GitHub's dark mode

## Installation

### Chrome / Edge / Brave

1. Open `chrome://extensions/` (or `edge://extensions/` for Edge)
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `github-bot-collapser` folder

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` file in this folder

## Usage

Bot comments are automatically collapsed when you visit a GitHub PR or issue page.

### Visual Indicators

- **Blue left border** = Bot comment
- **Purple left border** = Bot review
- **Faded (60% opacity)** = Collapsed
- **Full opacity + stronger border** = Expanded

### Interaction

- **Click** the comment header to expand/collapse
- Use the **sidebar widget** for bulk actions

### Console Commands

```javascript
githubBotCollapser.collapseAll();    // Collapse all
githubBotCollapser.expandAll();      // Expand all
githubBotCollapser.processAllComments(); // Re-scan page
```

## How it detects bots

1. "Bot" or "App" badge next to usernames
2. Hovercard URLs containing `/apps/` or `/bots/`
3. `[bot]` suffix in usernames

## Supported Bot Types

- GitHub Apps (dependabot, renovate, coderabbitai, etc.)
- GitHub Actions bots
- Any account with the "Bot" badge
- Copilot code review comments

## License

MIT
