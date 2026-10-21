/* Stretchtext — grow any page in place.
 * Select text and click the bubble, or Alt+Click a word.
 * Expansion is generated with Pollinations and paid with the reader's own Pollen.
 */
(() => {
  if (window.__stretchtextLoaded) return;
  window.__stretchtextLoaded = true;

  const DEFAULT_MODEL = "openai/gpt-5.4-nano";
  const state = { enabled: true, model: DEFAULT_MODEL, key: "" };

  chrome.storage.local.get(["enabled", "model", "polli_key"], (v) => {
    state.enabled = v.enabled !== false;
    state.model = v.model || DEFAULT_MODEL;
    state.key = v.polli_key || "";
  });
  chrome.storage.onChanged.addListener((ch) => {
    if (ch.enabled) state.enabled = ch.enabled.newValue !== false;
    if (ch.model) state.model = ch.model.newValue || DEFAULT_MODEL;
    if (ch.polli_key) state.key = ch.polli_key.newValue || "";
  });

  // ---------- UI host (shadow DOM so page CSS cannot break it) ----------
  const host = document.createElement("div");
  host.id = "stretchtext-host";
  host.style.cssText =
    "all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      .bubble {
        position: fixed; transform: translate(-50%, -100%);
        display: flex; align-items: center; gap: 6px;
        padding: 6px 10px; border-radius: 999px;
        background: #16181d; color: #f5f5f4; border: 1px solid #3a3f47;
        font: 500 13px/1.2 ui-sans-serif, system-ui, -apple-system, sans-serif;
        box-shadow: 0 8px 24px rgba(0,0,0,.28); cursor: pointer;
        user-select: none; white-space: nowrap;
      }
      .bubble:hover { background: #23262d; }
      .bubble .mark { font-size: 14px; line-height: 1; color: #f4b860; }
    </style>
    <div class="bubble" role="button" tabindex="0" hidden>
      <span class="mark">⤢</span><span>Stretch</span>
    </div>`;
  const bubble = shadow.querySelector(".bubble");
  let pendingSelection = null;

  function mount() {
    if (!host.isConnected) (document.documentElement || document.body).appendChild(host);
  }

  function showBubble(rect) {
    mount();
    bubble.hidden = false;
    const top = Math.max(8, rect.top - 8);
    bubble.style.left = `${Math.min(window.innerWidth - 70, Math.max(70, rect.left + rect.width / 2))}px`;
    bubble.style.top = `${top}px`;
  }

  function hideBubble() {
    bubble.hidden = true;
  }

  // ---------- helpers ----------
  const BLOCK_SELECTOR =
    "p,li,td,th,dd,dt,blockquote,figcaption,h1,h2,h3,h4,h5,h6,div,article,section,main";

  function blockOf(node) {
    let el = node && (node.nodeType === 1 ? node : node.parentElement);
    while (el && !el.matches?.(BLOCK_SELECTOR)) el = el.parentElement;
    return el || document.body;
  }

  function contextFor(node) {
    const el = blockOf(node);
    return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 1600);
  }

  function expandWordAt(x, y) {
    const doc = document;
    let range = null;
    if (doc.caretRangeFromPoint) range = doc.caretRangeFromPoint(x, y);
    else if (doc.caretPositionFromPoint) {
      const pos = doc.caretPositionFromPoint(x, y);
      if (pos) {
        range = doc.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (!range || !range.startContainer || range.startContainer.nodeType !== 3) return null;
    const text = range.startContainer.textContent || "";
    let s = range.startOffset;
    let e = range.startOffset;
    while (s > 0 && /[\p{L}\p{N}_'’-]/u.test(text[s - 1])) s--;
    while (e < text.length && /[\p{L}\p{N}_'’-]/u.test(text[e])) e++;
    if (e - s < 2) return null;
    const r = doc.createRange();
    r.setStart(range.startContainer, s);
    r.setEnd(range.startContainer, e);
    return r;
  }

  // ---------- generation ----------
  async function generate(phrase, context) {
    const messages = [
      {
        role: "system",
        content:
          "You are the expansion engine of a stretchtext reader. The reader selected a phrase and wants it grown in place. " +
          "Write 1-2 sentences of specific, non-redundant detail that fits the surrounding context. " +
          "Rules: use the same language as the context; plain text only; no markdown, quotes or headings; " +
          "do not repeat the selected phrase; do not start with a preamble such as 'Here is' or 'Sure'. " +
          "If the context already covers it, add a useful concrete detail instead of contradicting the text."
      },
      {
        role: "user",
        content: `Context:\n${context}\n\nSelected phrase: "${phrase}"\n\nWrite only the inserted text.`
      }
    ];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.key}`
        },
        body: JSON.stringify({
          model: state.model,
          messages,
          temperature: 0.7,
          max_tokens: 220
        })
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error("AUTH");
      }
      if (res.status === 402) throw new Error("POLLEN");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const out =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ??
        "";
      return String(out).trim().replace(/^["'«»]+|["'«»]+$/g, "");
    } finally {
      clearTimeout(timer);
    }
  }

  function makeExpansion() {
    const wrap = document.createElement("span");
    wrap.dataset.stretchtext = "1";
    wrap.setAttribute("role", "note");
    wrap.setAttribute("tabindex", "0");
    wrap.title = "Click to collapse";
    wrap.style.cssText = [
      "background:linear-gradient(transparent 60%, rgba(244,184,96,.28) 60%)",
      "border-bottom:1px dotted rgba(180,120,20,.65)",
      "cursor:pointer",
      "transition:background .15s ease"
    ].join(";");
    const text = document.createElement("span");
    text.className = "stretchtext-text";
    text.textContent = "…";
    const close = document.createElement("span");
    close.textContent = " −";
    close.setAttribute("aria-label", "Collapse");
    close.style.cssText = "opacity:.55;font-size:.85em;margin-left:2px";
    wrap.append(text, close);
    wrap.addEventListener("click", (e) => {
      e.stopPropagation();
      wrap.remove();
    });
    wrap.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        wrap.remove();
      }
    });
    return wrap;
  }

  function insertAtRangeEnd(range, node) {
    const r = range.cloneRange();
    r.collapse(false);
    r.insertNode(node);
    // insertNode splits the text node; keep a space between text and expansion
    return node;
  }

  async function stretchRange(range) {
    const phrase = range.toString().trim();
    if (!phrase) return;
    if (!state.key) {
      notify("Connect your Pollen account first — open the Stretchtext options.");
      chrome.runtime.sendMessage({ type: "open-options" });
      return;
    }
    hideBubble();
    const context = contextFor(range.startContainer);
    const wrap = makeExpansion();
    insertAtRangeEnd(range, wrap);
    const textEl = wrap.querySelector(".stretchtext-text");
    try {
      const out = await generate(phrase, context);
      if (!out) throw new Error("EMPTY");
      textEl.textContent = " " + out;
      wrap.setAttribute("aria-label", `Expansion: ${out}`);
    } catch (err) {
      const msg =
        err.message === "AUTH"
          ? "authorization failed — reconnect in options"
          : err.message === "POLLEN"
            ? "not enough Pollen — top up at enter.pollinations.ai"
            : "could not stretch this text, try again";
      textEl.textContent = ` (${msg})`;
      wrap.style.borderBottomColor = "rgba(200,60,50,.7)";
      setTimeout(() => wrap.remove(), 6000);
    }
    window.getSelection()?.removeAllRanges();
  }

  function notify(text) {
    mount();
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);" +
      "background:#16181d;color:#f5f5f4;padding:9px 14px;border-radius:10px;" +
      "font:500 13px/1.3 ui-sans-serif,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3);" +
      "border:1px solid #3a3f47;z-index:2147483647;max-width:80vw";
    shadow.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  // ---------- events ----------
  bubble.addEventListener("click", () => {
    if (pendingSelection) {
      const range = pendingSelection.getRangeAt(0).cloneRange();
      stretchRange(range);
    }
  });
  bubble.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      bubble.click();
    }
  });

  document.addEventListener("mouseup", (e) => {
    if (!state.enabled) return;
    if (e.target === host || host.contains(e.target)) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (!text || text.length < 2 || !sel.rangeCount) {
        hideBubble();
        return;
      }
      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        hideBubble();
        return;
      }
      pendingSelection = sel;
      const rect = range.getBoundingClientRect();
      showBubble(rect);
    }, 10);
  });

  document.addEventListener("mousedown", (e) => {
    if (e.target === host || host.contains(e.target)) return;
    hideBubble();
  });

  document.addEventListener("click", (e) => {
    if (!state.enabled || !e.altKey) return;
    if (e.target.closest?.("[data-stretchtext]")) return;
    const range = expandWordAt(e.clientX, e.clientY);
    if (!range) return;
    e.preventDefault();
    stretchRange(range);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "stretch-selection") {
      const sel = window.getSelection();
      if (sel && sel.rangeCount && sel.toString().trim()) {
        stretchRange(sel.getRangeAt(0).cloneRange());
      } else {
        notify("Select some text first.");
      }
    }
  });
})();
