[![Made with pollinations.ai](https://raw.githubusercontent.com/pollinations/pollinations/main/packages/ui/src/brand/badge-made-with.svg)](https://pollinations.ai/?ref=badge)

# Stretchtext

A browser extension that turns any web page into [stretchtext](https://en.wikipedia.org/wiki/StretchText): text that grows where you want more and shrinks back where you don't.

Select a phrase on any page and click **⤢ Stretch** — a sentence or two appears inline, right where you were reading. Click the addition to collapse it. `Alt+Click` a word to stretch it without selecting.

Readers pay with their own [Pollen](https://enter.pollinations.ai) through [BYOP](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md): the extension only holds a scoped key the reader authorized, with a budget and an expiry, revocable at any time.

## Install

1. Download the latest `stretchtext.zip` from [Releases](https://github.com/SvirepyiBambr/stretchtext/releases).
2. Unzip it somewhere permanent.
3. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, pick the unzipped folder.
4. Open the extension options, click **Connect Pollinations** and approve the device code.

Works in Chrome, Edge, Brave and any Chromium-based browser with Manifest V3. Firefox support is not tested yet.

## How it works

- `content.js` — selection bubble, inline expansion, collapse. The generated text is inserted as a `<span>` at the end of the selection, so it follows the page's own text flow.
- `options.js` — BYOP device flow: `POST /api/device/code`, opens the approval page, polls `/api/device/token`, stores the returned `sk_...` key in `chrome.storage.local`.
- Generation goes to `POST https://gen.pollinations.ai/v1/chat/completions` with the reader's key. The prompt includes the surrounding paragraph for context, and asks for 1–2 sentences in the same language with no repetition and no preamble.
- Nothing leaves the page except the selected phrase and its paragraph.

## Development

No build step. Load the folder directly as an unpacked extension.

```
manifest.json
content.js        # in-page stretchtext
background.js     # context menu
options.html/js   # BYOP device flow, model choice
popup.html/js     # on/off, connection status
```

App key (`pk_...`) in `options.js` is publishable and safe to ship.

## Privacy

- Selected text and its surrounding block are sent to Pollinations to generate the expansion.
- The user key stays in extension storage; it is never sent anywhere except Pollinations.
- No analytics, no tracking, no remote code.

## License

MIT
