# WORKLOG

## 1. Current Project State

Project: `ChatGPT Speed Trim`

Workspace:

- current workspace folder ends with `...\gptspeeder`

Current overall status:

- MVP extension exists
- popup exists
- DOM pruning exists
- enable toggle exists
- Ko-fi link exists
- progressive reload-based reveal exists
- pre-render network trimming is now being added to reduce memory more aggressively

## 2. Fixed Product Decisions

These are already decided and should be treated as stable.

- fully free
- no paywall
- no license key
- no usage cap
- no analytics
- no backend
- popup keeps only essential controls
- Ko-fi URL is fixed to `https://ko-fi.com/imhansu`

## 3. Why The Architecture Pivoted

Initial MVP logic:

- let ChatGPT load the whole conversation
- remove older DOM nodes afterward

Result:

- it worked functionally
- it improved responsiveness
- but memory reduction was not dramatic enough

Observed user feedback:

- memory could still spike too high
- compared with another extension, memory savings were not strong enough

Conclusion:

- post-render DOM pruning alone is not enough
- conversation payload needs to be trimmed earlier, before ChatGPT builds its internal app state

## 4. What Already Worked Before The New Pivot

Confirmed by user testing:

- changing `keepCount` worked
- hidden messages were trimmed correctly
- placeholder appeared correctly
- scroll did not jump badly
- Ko-fi button opened correctly
- enable toggle existed and worked at the UI level

These were all real user-tested wins and should be preserved.

## 5. Most Important New Decision

The extension should no longer keep hidden message DOM nodes in memory.

New rule:

- hidden messages are removed
- they are not archived in memory for instant restore
- `Load 20 more messages` increases the visible range and reloads the page

Why:

- memory savings matter more than instant restore
- old nodes sitting in memory defeat the point

## 6. New Memory Strategy

The current target architecture is:

1. intercept conversation responses in the page world
2. trim the payload to the latest visible suffix
3. record hidden-count metadata in `sessionStorage`
4. let the content script use that metadata for UI and fallback behavior
5. only use DOM pruning as a fallback or secondary layer

This is the major change from the earlier MVP.

Small hardening choices already applied:

- metadata no longer stores request URLs
- main-world settings refresh now re-reads mirrored `localStorage`
- the previous `window.postMessage` settings update path was removed

## 7. Files That Matter Most Right Now

### Core config

- `manifest.json`

### Settings

- `src/shared/constants.js`
- `src/shared/storage.js`

### Early injection

- `src/content/bootstrap.js`
- `src/injected/interceptor.js`

### DOM fallback

- `src/content/dom.js`
- `src/content/prune.js`
- `src/content/content.js`
- `src/content/ui.js`

### Popup

- `src/popup/popup.html`
- `src/popup/popup.css`
- `src/popup/popup.js`

### Docs

- `DESIGN.md`
- `WORKLOG.md`
- `STORE_LISTING.md`
- `PRIVACY_POLICY.md`
- `RELEASE_CHECKLIST.md`

## 8. Important Runtime Model

### Settings source of truth

- `chrome.storage.local`

Shape:

```json
{
  "enabled": true,
  "keepCount": 16,
  "loadMoreCount": 20
}
```

### Page-visible settings mirror

- `localStorage["chat-speed-trim:page-settings"]`

Reason:

- injected page script cannot directly use `chrome.storage`
- content script mirrors settings into page storage

### Conversation metadata

- `sessionStorage["chat-speed-trim:meta:<conversationKey>"]`

Reason:

- after network trim, DOM no longer contains enough information to know how many messages are hidden
- metadata preserves that count for the placeholder and reload logic

### Reveal offset

- `sessionStorage["chat-speed-trim:reveal:<conversationKey>"]`

Reason:

- `Load 20 more messages` must survive page reloads while the user is exploring more history
- a separate popup reset button now returns the current chat to the base keep count when the user wants that

## 9. Current Known Risks

### Risk A: ChatGPT payload format may change

The network interceptor depends on finding a response with:

- `mapping`
- `current_node`

If ChatGPT changes this shape, the trim logic may stop applying.

Fallback:

- DOM pruning should still keep the extension usable

### Risk B: request URL detection may be incomplete

If ChatGPT moves conversation loading to a different endpoint, fetch/XHR interception may miss it.

### Risk C: first-kept-node reparenting may need tuning

The network trim currently keeps the latest suffix and optionally a non-renderable anchor node.
If ChatGPT becomes sensitive to missing ancestors, this logic may need adjustment.

## 10. Current Checklist

### Implemented

- [x] manifest
- [x] popup UI
- [x] popup toggle
- [x] popup keep-count input
- [x] popup load-more-count input
- [x] popup reset-current-chat button
- [x] Ko-fi button
- [x] settings storage
- [x] DOM message detection
- [x] placeholder UI
- [x] reload-based `Load 20 more messages`
- [x] settings mirror into page-visible storage
- [x] main-world injected interceptor
- [x] fetch patch
- [x] XHR patch
- [x] conversation metadata handoff design

### Still needs real-world validation

- [ ] confirm network trimming is actually applied on the current ChatGPT site
- [ ] confirm memory drops more than before
- [ ] confirm hidden-count placeholder is still correct after network trimming
- [ ] confirm `Load 20 more messages` still works after network trimming
- [ ] confirm enable toggle still behaves correctly
- [ ] confirm keep-count increases behave acceptably

## 11. Manual Test Plan For The Next Run

After reloading the unpacked extension:

1. reload the extension in `chrome://extensions`
2. refresh the ChatGPT tab
3. open a very long chat
4. inspect whether only the latest visible turns render
5. check Chrome memory usage after settling
6. click `Load 20 more messages`
7. verify reload happens
8. verify more turns appear
9. verify the remaining hidden count shrinks
10. toggle `Enable Speed Trim` off
11. confirm full-page reload behavior if needed
12. toggle back on

## 12. What To Do If Network Trimming Still Does Not Save Enough Memory

If memory is still not good enough, investigate in this order:

1. verify the interceptor is actually seeing the conversation request
2. verify the response shape still contains `mapping/current_node`
3. log whether trimming changed the payload or returned original data
4. if needed, broaden request detection
5. if needed, strip more data from kept nodes
6. if needed, keep a lighter root anchor or no anchor

The next likely improvement path is not "more DOM tricks".
It is "better pre-render response trimming".

## 13. Notes About Documentation

Older versions of `DESIGN.md` and `WORKLOG.md` had stale references to:

- in-memory archived hidden nodes
- full restore behavior
- older popup scope
- outdated product assumptions

Those are now obsolete.

Future edits should preserve the current reality:

- reload-based reveal
- memory-first design
- no paywall
- optional Ko-fi only

## 14. Session Log

### 2026-04-12: product direction settled

User clarified the product should stay very simple:

- hide older messages
- keep only the latest `N`
- no advanced rules

Then product direction was simplified further:

- release it free
- no fake premium tier
- only keep-count setting plus donation button

### 2026-04-12: Ko-fi setup finalized

User chose Ko-fi and connected PayPal.

Final support URL:

- `https://ko-fi.com/imhansu`

### 2026-04-12: first MVP built and tested

User confirmed these behaviors worked:

- keep-count changes worked
- messages trimmed correctly
- scroll did not jump
- hidden-message UI worked
- Ko-fi button worked

### 2026-04-12: memory problem surfaced

User reported memory was still too high.

Interpretation:

- old DOM trimming improved rendering
- but the page still held too much conversation state internally

### 2026-04-12: reload-based reveal adopted

Hidden DOM nodes were no longer retained.

New behavior:

- hidden nodes removed
- reveal happens by reload
- each click loads 20 more

### 2026-04-12: pre-render trimming started

New work was started to intercept conversation responses earlier and trim them before ChatGPT renders them.

That is the main current milestone.

### 2026-04-12: release prep docs added

Release prep documents were added for store submission:

- `STORE_LISTING.md`
- `PRIVACY_POLICY.md`
- `RELEASE_CHECKLIST.md`

### 2026-04-15: README added

A public-facing `README.md` was added with:

- product overview
- target users
- supported sites
- installation instructions
- usage instructions
- support contact and Ko-fi link
- current license-status note

### 2026-04-15: MIT license added

The repository now includes an `MIT` license file and the README license section was updated to point to it.

## 15. If A Future Session Starts Cold

Read in this order:

1. `WORKLOG.md`
2. `DESIGN.md`
3. `manifest.json`
4. `src/content/bootstrap.js`
5. `src/injected/interceptor.js`
6. `src/content/prune.js`

Then do the manual test plan above before making more architecture changes.
