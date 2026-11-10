# GPTlagfixer

Keep long ChatGPT chats light by rendering only the most recent messages.

`GPTlagfixer` is a small Chrome extension for people whose long ChatGPT conversations start feeling heavy, laggy, or memory-hungry.

It is designed to stay simple:

- no paywall
- no backend
- no analytics
- no tracking
- no account

If you want to support the project, the popup includes an optional Ko-fi tip button.

Disclaimer: This extension is an unofficial tool and is not affiliated with OpenAI.

## Why this exists

Long ChatGPT conversations can become sluggish after hundreds or thousands of turns.

In practice, the problem is not only the text itself. The browser also has to keep a very large rendered page, UI state, and conversation structure alive at the same time. That can make typing, scrolling, loading, and general navigation feel much heavier than they should.

This extension was built to address that specific problem:

- long chats start lagging
- browser memory usage climbs too high
- the page becomes uncomfortable to use even though the conversation itself is still valuable

The goal is not to change ChatGPT's answers or add a new workflow. The goal is simply to make very long chats feel usable again.

## Who this is for

This extension is mainly for people who keep unusually long ChatGPT threads alive, such as:

- researchers
- developers
- writers
- power users
- people using one chat as a long-running workspace

If you usually open short, disposable chats, you may not need it. If you keep one thread going for days or weeks, this is the kind of use case it targets.

## What it does

By default, the extension keeps only the latest part of a long conversation visible.

Older messages are hidden so the page stays lighter. When you want to look further back, you can load older messages in chunks. If you want to go back to the base view, you can reset the current chat from the popup.

## Main features

- choose how many messages stay visible
- choose how many older messages load each time
- enable or disable trimming with one toggle
- reset the current chat back to the base visible count
- optional Ko-fi support button
- fully local behavior with no server dependency

## Supported browser and sites

### Browser

Officially built for `Google Chrome 111+` as a `Manifest V3` extension.

Because it uses standard Chrome extension APIs, other Chromium-based browsers may work, but the project is currently targeted at Chrome first.

### Supported sites

The extension only runs on:

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

## How it works

The extension reduces what ChatGPT needs to keep actively rendered in the browser.

At a high level, it works in two layers:

1. It tries to intercept conversation data very early and trim the visible conversation down to the latest suffix before the page fully renders everything.
2. It also keeps a DOM-side fallback layer so the page can still be cleaned up even if ChatGPT changes part of its internal loading behavior.

This is why it helps with both responsiveness and memory pressure:

- fewer visible conversation entries
- less page weight
- less heavy scrolling and layout work
- smaller active working set in long chats

When you press `Load more messages`, the extension expands the visible range in chunks instead of restoring the whole conversation all at once.

### Step-by-step flow

1. At `document_start`, Chrome runs the manifest-declared `MAIN` world hook before the site's scripts. No script tag is inserted into the page.
2. It watches ChatGPT conversation responses and tries to keep only the latest visible suffix.
3. It stores only lightweight local state for settings and current-chat reveal ranges.
4. If early trimming does not apply, the content-side fallback still trims older rendered content.
5. The page shows a small banner that tells you how many earlier messages are hidden and lets you load more in chunks.

### How hidden message counting works

The hidden count is based on conversation turns that are considered renderable, not simply raw text blocks.

In practice, that means:

- a user prompt usually counts as one message
- an assistant reply usually counts as one message
- internal non-user-facing nodes are ignored where possible
- the number may not always match what you would estimate by visually counting paragraphs

So the hidden count is best understood as a practical conversation-entry count rather than a perfect human eyeball count.

## Privacy and data behavior

This extension is designed to work fully locally in your browser.

It does not use:

- a backend server
- analytics
- tracking
- ads
- remote logging

It stores only a small amount of local browser data for settings and temporary per-chat state, such as:

- whether the extension is enabled
- how many messages remain visible
- how many messages load each time
- temporary current-chat reveal state

For the full policy, see [PRIVACY_POLICY.md](./PRIVACY_POLICY.md).

## Installation

### Install from source in Chrome

1. Download or clone this repository.
2. Make sure you keep the project structure intact.
3. Open `chrome://extensions`
4. Turn on `Developer mode`
5. Click `Load unpacked`
6. Select the project folder that contains `manifest.json`

Important:

- downloading only `src/` is not enough
- Chrome needs the folder that contains both `manifest.json` and `src/`

Expected structure:

```text
gptlagfixer/
  manifest.json
  src/
  README.md
```

## How to use

1. Open a long ChatGPT conversation.
2. Open the extension popup.
3. Set `Messages to keep visible`.
4. Set `Messages to load each time` if you want a different reveal chunk size.
5. Leave `Enable Speed Trim` on.

Once active, the page will keep only the most recent part of the conversation visible.

If you need older context:

- click `Load more messages` inside the chat page

If you want to go back to the base trimmed view:

- open the popup
- click `Reset current chat`

If you want to temporarily stop trimming:

- open the popup
- turn off `Enable Speed Trim`
- refresh the ChatGPT page if needed

### Updating an existing source installation

1. Replace your extension source with the latest repository files, or run `git pull` in your existing clone.
2. Open `chrome://extensions` and click the reload button on GPTlagfixer.
3. Refresh existing ChatGPT tabs. Existing tabs keep the old injected code until refreshed.

If using this clone for the first time, choose its folder with `Load unpacked`.
Enabling trimming and changing the visible count on a network-trimmed chat can reload the tab so the page's conversation data matches the setting.

### Checking whether memory trimming is active

Open the extension popup while the ChatGPT tab is active:

- `Network trim active` means older messages were removed from the response before the page read it.
- `Page trim active` means only the DOM fallback applied. This can improve rendering, but the site's full conversation data may remain in memory. Refresh the tab to retry network trimming.
- If no messages have been trimmed, open a long chat or refresh the current tab.

The extension cannot guarantee a particular memory saving. Unsupported response formats pass through unchanged.

## Development checks

The installed extension needs no build step or Node dependencies. Development tests use Node.js 20+:

```sh
npm install
npm test
npx playwright install chromium
npm run test:browser
```

The browser suite loads the actual unpacked extension into a temporary profile and routes both supported hosts to synthetic conversations. It tests the early hook under strict CSP/Trusted Types, fetch and XHR, reveal/reset, settings, runtime status, SPA navigation, and DOM fallback. It never uses a ChatGPT account. To use an installed Chromium browser, set `GPTLAGFIXER_BROWSER` to its executable path; that browser must allow unpacked extension loading by command-line flags.

In the synthetic 1,000-message case, 16 messages plus a root anchor reach the page (18,261 JSON characters versus 1,133,075). This measures response reduction, not real ChatGPT memory usage. Live authenticated-site compatibility and memory measurements remain manual checks in [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

## FAQ

### Does this reduce the model's context?

No.

This extension is meant to reduce what your browser actively renders, not erase your conversation from OpenAI's side. Its purpose is performance in the browser UI.

### Is my data safe?

The extension is designed to work locally.

- no backend
- no analytics
- no tracking
- no remote logging
- no core-functionality network service operated by the developer

The optional Ko-fi button is just an external support link that opens only if you choose to click it.

### What happens if ChatGPT changes its UI or response format?

That is the main compatibility risk for this kind of extension.

If ChatGPT changes enough, trimming may stop working correctly until the extension is updated. The intended behavior is fail-safe: the extension should stop trimming rather than corrupting the conversation page.

### Why not just hide DOM nodes after the page loads?

That was not enough on its own for very large chats.

The project moved toward earlier response trimming because post-render cleanup alone improved responsiveness but did not reduce memory usage aggressively enough in the heaviest conversations.

## Support

The extension is free forever.

If it helped make your long ChatGPT chats faster, you can support ongoing development and maintenance here:

- [Ko-fi](https://ko-fi.com/imhansu)

If something is broken or unclear, contact:

- `imhansu13@gmail.com`

## Disclaimer

This extension is an unofficial program and is not affiliated with, endorsed by, or sponsored by OpenAI.

## License

This project is licensed under the `MIT License`.

See [LICENSE](./LICENSE) for details.
