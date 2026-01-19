# GitHub PR Slop Hider

A browser extension that automatically hides comments from bots on GitHub PRs and issues, reducing AI slop noise.

## Features

- Automatically detects and hides bot comments on page load
- Circular eye toggle button positioned to the right of each bot comment header
- Eye icons indicate action: open eye = click to show, closed eye = click to hide
- Sidebar widget showing "X hidden, Y shown" with bulk Hide All / Show All buttons
- Only collapses substantial content (comments, reviews) - skips simple actions like "added a label"
- Supports dynamically loaded comments ("Load more...")
- Dark mode support

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

Bot comments are automatically hidden when you visit a GitHub PR or issue page.

### Toggle Button

A circular button with an eye icon appears to the right of each bot comment header:
- **Open eye** = Content is hidden, click to show
- **Closed eye** = Content is visible, click to hide
- Hover color: blue for comments, purple for reviews

### Sidebar Widget

Located at the top of the PR sidebar:
- Shows count of bot comments found
- Displays "X hidden, Y shown" status
- **Hide All** / **Show All** buttons for bulk actions

### Console Commands

```javascript
githubBotCollapser.collapseAll();        // Hide all bot comments
githubBotCollapser.expandAll();          // Show all bot comments
githubBotCollapser.processAllComments(); // Re-scan page for new comments
githubBotCollapser.updateSidebarWidget(); // Refresh sidebar counts
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
