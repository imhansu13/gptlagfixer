# Chrome Web Store Listing Draft

## Extension Name

ChatGPT Speed Trim

## One-line Summary

Keep long ChatGPT chats fast by showing only the most recent messages.

## Single Purpose

Keeps long ChatGPT conversations responsive by limiting how many recent messages are rendered at once.

## Detailed Description

ChatGPT Speed Trim helps long ChatGPT conversations stay fast and responsive.

When a chat gets very large, the extension keeps only the most recent messages visible by default, which reduces lag, lowers memory pressure, and makes scrolling and typing feel lighter.

If you want to look further back, you can load older messages in chunks without turning the whole extension off.

What it does:

- keeps only the latest messages visible in long ChatGPT chats
- lets you choose how many messages stay visible
- lets you choose how many older messages load each time
- includes a reset button to return the current chat to the base visible count
- works fully locally in your browser

What it does not do:

- no paywall
- no backend
- no tracking
- no analytics
- no account required

Supported sites:

- `chatgpt.com`
- `chat.openai.com`

## Privacy Tab Copy

### Single purpose description

This extension keeps long ChatGPT conversations responsive by limiting how many recent messages are rendered at once.

### Permissions justification

`storage`

Used to save the user's local extension settings, including:

- whether the extension is enabled
- how many messages stay visible
- how many messages load each time

### Host permissions justification

`https://chatgpt.com/*`
`https://chat.openai.com/*`

Required so the extension can run on ChatGPT pages and reduce the number of rendered messages in long conversations.

### Remote code

No, this extension does not use remote code.

### Data usage disclosure

This extension does not send chat data to any server.
It does not use analytics, tracking, or a backend.
Settings are stored locally in the browser.

## Suggested Store Copy Variants

### Shorter variant

Reduce lag in long ChatGPT chats by rendering only the most recent messages.

### More direct variant

Long ChatGPT conversation getting heavy? This extension keeps the latest messages visible so the page stays lighter and faster.

## Suggested Screenshots

1. Popup showing:
   - messages to keep visible
   - messages to load each time
   - enable toggle

2. Long chat with the in-page banner:
   - `1041 earlier messages hidden to keep this chat fast.`
   - `Load 20 more messages`

3. Popup showing the reset button for the current chat.

4. Before/after style screenshot:
   - very long chat with banner visible
   - caption emphasizing reduced lag and lower memory pressure

5. Support section and contact/footer visible at the bottom of the popup.

## Suggested Screenshot Captions

- Keep long chats light.
- Load older messages only when you need them.
- Choose how many messages stay visible.
- Reset the current chat back to your base view anytime.
- Free forever. No paywall. No backend. No tracking.

## Notes

- Avoid claiming exact memory savings in the store listing unless you want to maintain proof for every ChatGPT UI change.
- Avoid phrases like "best", "number one", or unverifiable performance claims.
- Keep the message focused on one narrow purpose: faster long ChatGPT chats.
