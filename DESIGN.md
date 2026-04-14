# GPTlagfixer Design

## 1. Product Summary

`GPTlagfixer` is a Chrome Manifest V3 extension for long ChatGPT chats.

Its job is simple:

- keep only the latest `N` visible chat turns active in the page
- hide older turns to reduce lag and browser memory pressure
- let the user load older turns in fixed-size chunks by reloading the page
- stay fully local, fully free, and as simple as possible

This project is intentionally **not** a general "AI productivity suite".
It is a narrow performance utility.

## 2. Final Product Decisions

These decisions are fixed unless the user explicitly changes direction later.

- Pricing: fully free
- Paywall: none
- Usage limits: none
- Licensing system: none
- Analytics/tracking: none
- Remote backend: none
- Donation: optional Ko-fi button only
- Donation URL: `https://ko-fi.com/imhansu`

## 3. Core User Value

Problem:

- very long ChatGPT chats become slow
- scrolling can lag
- typing can feel delayed
- memory usage can grow too large

User-facing promise:

- keep long chats responsive by only loading the latest visible section

The extension improves:

- browser rendering load
- DOM size
- app-side memory usage when conversation payload trimming succeeds

The extension does **not** improve:

- OpenAI server response speed
- model intelligence or quality
- model context window limits

## 4. Main Rule

The main rule is:

> If the conversation contains more visible chat turns than `keepCount`, only the latest `keepCount` turns remain visible by default.

Example:

- `keepCount = 16`
- chat has 260 visible turns
- the newest 16 stay visible
- older turns are hidden
- the placeholder offers `Load 20 more messages`
- clicking it reloads the page and increases the visible window by 20

## 5. Why The Architecture Changed

### Old approach

The first MVP trimmed the DOM **after** ChatGPT had already loaded the whole conversation.

That helped with rendering lag, but memory savings were limited because:

- ChatGPT had already parsed the full conversation
- React/app state still held old messages
- removed DOM nodes did not guarantee deep app-state memory savings

### New approach

The new architecture trims the conversation response **before** ChatGPT renders it when possible.

This is much more aggressive:

- older turns never reach the app in full form
- the DOM starts smaller
- React/app state starts smaller
- memory pressure should drop more than post-render DOM pruning alone

DOM pruning still exists as a fallback layer.

## 6. Current Architecture

The extension now uses two layers.

### Layer A: pre-render network trimming

Runs in the page's main world through an injected script at `document_start`.

Responsibilities:

- patch `fetch`
- patch `XMLHttpRequest`
- inspect conversation JSON responses
- trim the conversation payload to the latest visible suffix
- store metadata in `sessionStorage` so the content script knows how many turns are hidden

This is the main memory-saving layer.

### Layer B: content-script fallback pruning

Runs as a normal extension content script.

Responsibilities:

- inject the main-world interceptor
- sync extension settings into page-accessible storage
- detect message blocks in the rendered DOM
- hide extra visible turns if the network-trimmed payload still shows too much
- render the in-page placeholder UI
- handle `Load 20 more messages`

This is the safety net.

## 7. Settings Model

Stored in `chrome.storage.local`.

Shape:

```json
{
  "enabled": true,
  "keepCount": 16,
  "loadMoreCount": 20
}
```

Defaults:

- `enabled = true`
- `keepCount = 16`
- `loadMoreCount = 20`

Constraints:

- min keep count: `4`
- max keep count: `200`
- min load-more count: `5`
- max load-more count: `200`

## 8. Load More Model

This extension no longer keeps hidden DOM nodes in memory.

Instead:

- hidden turns are removed
- the next reveal amount is tracked in `sessionStorage`
- clicking `Load 20 more messages` increases the reveal offset by 20
- the page reloads
- the next load keeps `keepCount + revealOffset`

This is important because it avoids holding old turns in a hidden in-memory archive.

## 9. Storage Keys

### Extension storage

- `settings`

### Page localStorage mirror

- `chat-speed-trim:page-settings`

Used so the injected page script can read settings without direct access to `chrome.storage`.

### sessionStorage keys

- reveal offset prefix: `chat-speed-trim:reveal:`
- conversation metadata prefix: `chat-speed-trim:meta:`

## 10. Conversation Metadata

When network trimming succeeds, the injected script writes metadata like:

```json
{
  "source": "network",
  "hiddenCount": 244,
  "totalVisibleCount": 260,
  "effectiveKeepCount": 16,
  "updatedAt": 1234567890
}
```

Why this exists:

- after pre-trim, the DOM only contains the visible suffix
- the content script can no longer infer total hidden count from DOM alone
- metadata lets the placeholder show the correct hidden count
- metadata also lets the fallback layer decide when a reload is needed

## 11. Network Trim Strategy

The injected script looks for conversation payloads with:

- a top-level `mapping`
- a top-level `current_node`

Then it:

1. builds the current-node ancestry chain
2. counts renderable turns on that chain
3. keeps only the latest suffix needed for `effectiveKeepCount`
4. optionally keeps a non-renderable anchor/root node
5. rewrites parent/child links for the kept subset
6. returns the trimmed JSON back to the page

Current heuristic for "renderable turn":

- message exists
- role is not `system`
- role is not `tool`
- message is not flagged as visually hidden

This heuristic is good enough for now, but it may need tuning if ChatGPT changes its payload format.

## 12. DOM Detection Strategy

The content script tries multiple selectors in this order:

1. `[data-testid^="conversation-turn-"]`
2. `[data-message-author-role]`
3. `article`

It then lifts them to stable top-level turn containers and filters non-meaningful nodes.

This logic lives in:

- `src/content/dom.js`

If ChatGPT changes markup, this file is the first place to revisit.

## 13. In-Page Placeholder Behavior

The in-page UI should stay minimal.

Current behavior:

- summary text:
  - `244 earlier messages hidden to keep this chat fast.`
- button text:
  - `Load 20 more messages`

The placeholder must:

- be visually clear
- not look like spam
- not block the conversation
- not duplicate itself

## 14. Popup Requirements

The popup should remain intentionally small.

Required controls:

- `Reset current chat` button
- `Enable Speed Trim` toggle
- `Messages to keep visible` number input
- `Messages to load each time` number input
- Ko-fi button

No dashboard.
No fake memory meter.
No PRO badges.
No upsell flow.

## 15. File Responsibilities

### Root

- `manifest.json`
  - MV3 config
  - content script registration
  - web-accessible injected script

- `DESIGN.md`
  - this design document

- `WORKLOG.md`
  - progress log and next-step notes

### Shared

- `src/shared/constants.js`
  - constants, storage keys, fixed URLs, UI constants

- `src/shared/storage.js`
  - read/write/normalize extension settings

### Content layer

- `src/content/bootstrap.js`
  - inject main-world interceptor
  - mirror settings into page-accessible storage

- `src/content/content.js`
  - initialize runtime
  - watch relevant DOM containers
  - trigger pruning

- `src/content/dom.js`
  - collect visible message blocks
  - detect the shared turn container
  - compute conversation key

- `src/content/prune.js`
  - fallback DOM pruning
  - reveal offset handling
  - placeholder mounting
  - reload decision logic

- `src/content/ui.js`
  - placeholder element creation and update

- `src/content/content.css`
  - in-page placeholder styles

### Injected main-world layer

- `src/injected/interceptor.js`
  - patch `fetch`
  - patch `XMLHttpRequest`
  - trim conversation JSON before page render
  - write conversation metadata
  - re-read mirrored settings from `localStorage` when requests are processed

### Popup

- `src/popup/popup.html`
- `src/popup/popup.css`
- `src/popup/popup.js`

## 16. Runtime Flow

### Page load

1. content script starts at `document_start`
2. `bootstrap.js` injects `src/injected/interceptor.js`
3. `bootstrap.js` mirrors settings into page storage
4. page interceptor patches network APIs
5. ChatGPT requests conversation data
6. interceptor trims conversation payload if possible
7. interceptor writes conversation metadata
8. ChatGPT renders the already-trimmed conversation
9. content script runs fallback DOM pruning if needed
10. placeholder is shown if hidden messages remain

### Load more flow

1. user clicks `Load 20 more messages`
2. content script increments reveal offset in `sessionStorage`
3. page reloads
4. interceptor reads the larger effective keep count
5. next load keeps more turns
6. placeholder updates with the new remaining hidden count

## 17. Known Tradeoffs

### Tradeoff A: response-shape fragility

The injected trim logic depends on ChatGPT response structure.

If OpenAI changes:

- request URLs
- conversation payload shape
- mapping/current node format

then network trimming may stop applying.

Fallback:

- DOM pruning still works
- performance may regress, but the extension should not hard-break the page

### Tradeoff B: reload is required for reveal

This is intentional.

Why:

- it avoids keeping hidden DOM in memory
- it avoids complex in-memory restore logic
- it fits the memory-first goal better than instant restore

### Tradeoff C: settings changes may sometimes require reload

If the page was already loaded with a smaller visible slice and the user asks for more history, the extension may need a reload to fetch older turns again.

This is acceptable for now.

## 18. Safety Rules

The extension must never:

- send chat data to a third-party server
- include analytics or tracking
- inject remote scripts
- request unnecessary permissions
- break the page if trimming fails

Failure policy:

- prefer "do nothing" over "break ChatGPT"
- catch errors and fall back quietly
- keep console warnings minimal and useful

## 19. Permissions

Current required permissions:

- `storage`

Host permissions:

- `https://chat.openai.com/*`
- `https://chatgpt.com/*`

No extra permissions unless clearly necessary later.

## 20. Current Release Goal

The next stable milestone is:

- extension loads cleanly in Chrome
- long ChatGPT chats stay meaningfully lighter
- placeholder accurately reports hidden turns
- `Load 20 more messages` works
- toggle and keep count still work
- Ko-fi button works

## 21. Manual Test Checklist

Test these in Chrome after loading the unpacked extension.

1. open a short chat
2. open a long chat
3. verify only the latest `keepCount` turns remain visible
4. verify the placeholder appears
5. verify `Load 20 more messages` reloads and reveals more
6. verify `Enable Speed Trim` off restores full page on reload
7. verify `Enable Speed Trim` on re-applies trimming
8. verify keep count changes still work
9. verify Ko-fi button opens `https://ko-fi.com/imhansu`
10. compare Chrome memory usage before and after

## 22. First Files To Read In A Future Session

If context is gone, read in this order:

1. `WORKLOG.md`
2. `DESIGN.md`
3. `manifest.json`
4. `src/content/bootstrap.js`
5. `src/injected/interceptor.js`
6. `src/content/prune.js`

That is enough to resume meaningful work quickly.
