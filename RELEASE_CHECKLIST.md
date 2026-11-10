# Release Checklist

## Before Upload

Version 0.1.1 automated checks (synthetic fixtures, 2026-11-10):

- [x] 10 Node regression tests pass
- [x] Unpacked MV3 extension runs its MAIN hook before page scripts under strict CSP/Trusted Types
- [x] 1,000-message fixture reduced to latest 16 before rendering
- [x] Reveal/reset, settings, runtime status, SPA replacement, DOM fallback, XHR text/json/reuse, both supported hosts pass in Chromium-based Edge
- [x] JavaScript syntax and Git whitespace checks pass

The manual items below remain open. Synthetic fixtures do not validate the live authenticated ChatGPT site or actual process memory savings.

- [ ] Reload the unpacked extension in `chrome://extensions`
- [ ] Test on `chatgpt.com`
- [ ] Test on `chat.openai.com`
- [ ] Verify long-chat trimming works
- [ ] Verify `Load more` works
- [ ] Verify `Reset current chat` works
- [ ] Verify keep-count setting works
- [ ] Verify load-more-count setting works
- [ ] Verify enable toggle works
- [ ] Verify Ko-fi button opens correctly
- [ ] Verify contact email is visible in the popup

## Store Assets

- [ ] Final extension icon prepared
- [ ] At least one clean popup screenshot prepared
- [ ] At least one long-chat in-page banner screenshot prepared
- [ ] Optional before/after marketing screenshot prepared

## Chrome Web Store Listing

- [ ] Use the copy in `STORE_LISTING.md`
- [ ] Fill in the single-purpose field
- [ ] Add the permission justifications
- [ ] Mark remote code as not used
- [ ] Fill in the data-use disclosure accurately
- [ ] Add the privacy policy URL or hosted policy text

## Privacy

- [ ] Publish `PRIVACY_POLICY.md` somewhere public
- [ ] Make sure the store privacy answers match the policy exactly

## Final Review

- [ ] Description does not overclaim exact performance numbers
- [ ] Listing says no paywall, no backend, and no tracking only if still true
- [ ] Permissions in the store match the actual manifest
- [ ] Screenshots reflect the current UI

## After Submission

- [ ] Watch for reviewer questions
- [ ] If review requests changes, update both code and listing copy together
- [ ] After approval, test the live store version once more
