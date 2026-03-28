# YouTube Watch Later Cleaner

A Tampermonkey userscript that removes only **fully-watched** videos from your YouTube Watch Later playlist — leaving partially-watched videos untouched.

## The Problem

YouTube's built-in "Remove watched videos" feature removes any video you've started, even if you've only watched 10 seconds of it. If you use Watch Later as a queue and tend to pause mid-video, this nukes videos you still intend to finish.

## How It Works

The script reads the red progress bar on each video thumbnail. Any video with **≥ 95% watch progress** is considered fully watched and flagged for removal. Videos with no progress or partial progress are left alone.

The 95% threshold (instead of 100%) accounts for YouTube stopping progress tracking a few seconds before the actual end of a video.

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension (Chrome, Firefox, Edge, or Safari).
2. Open Tampermonkey → **Create a new script**.
3. Delete the default contents and paste in the full contents of [`yt-watch-later-cleaner.user.js`](./yt-watch-later-cleaner.user.js).
4. Save (`Cmd+S` / `Ctrl+S`).

## Usage

1. Navigate to [youtube.com/playlist?list=WL](https://www.youtube.com/playlist?list=WL) (your Watch Later list).
2. A **WL Cleaner** panel appears in the bottom-right corner.
3. Click **Scan** — the script scrolls the page to load all videos, then counts how many are fully watched.
4. Click **Remove** — it removes them one by one with a short delay between each.
5. Use the **✕** button to dismiss the panel when you don't need it. It reappears the next time you visit Watch Later.

## Configuration

At the top of the script there are three constants you can adjust:

| Constant | Default | Description |
|---|---|---|
| `WATCHED_THRESHOLD_PCT` | `95` | Minimum watch % to consider a video "fully watched" |
| `REMOVAL_DELAY_MS` | `800` | Delay between removals in ms (lower = faster, less stable) |
| `MENU_OPEN_TIMEOUT_MS` | `2000` | How long to wait for the context menu to appear |

## Notes

- The script only runs on `youtube.com` and handles YouTube's single-page navigation — the panel shows and hides automatically as you move between pages.
- Fully watched videos are also logged to the browser console (`F12 → Console`) before removal, so you have a record of what was removed.
- The script interacts with YouTube's DOM directly and does not use any external APIs or send any data anywhere.
