/* Stretchtext options: BYOP device flow + model choice. */

const CLIENT_ID = "pk_BcIneUfGBoxRbDqP"; // publishable app key, safe to ship
const DEFAULT_MODEL = "openai/gpt-5.4-nano";
const $ = (id) => document.getElementById(id);

let polling = false;

function setMsg(text, isError = false) {
  $("msg").textContent = text || "";
  $("msg").style.color = isError ? "#f08a80" : "#f4b860";
}

function setConnected(key) {
  const on = Boolean(key);
  $("dot").classList.toggle("on", on);
  $("statusText").textContent = on ? "Connected — reading with your Pollen" : "Not connected";
  $("connect").hidden = on;
  $("disconnect").hidden = !on;
}

async function refresh() {
  const { polli_key, model } = await chrome.storage.local.get(["polli_key", "model"]);
  setConnected(polli_key);
  $("model").value = model || DEFAULT_MODEL;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  if (polling) return;
  polling = true;
  $("connect").disabled = true;
  setMsg("Requesting a device code…");
  try {
    const res = await fetch("https://enter.pollinations.ai/api/device/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: CLIENT_ID })
    });
    const data = await res.json();
    if (!res.ok || !data.device_code) {
      throw new Error(data.error_description || data.error || `HTTP ${res.status}`);
    }

    $("device").hidden = false;
    $("userCode").textContent = data.user_code;
    setMsg("Approve the request in the Pollinations tab.");
    if (data.verification_uri_complete) {
      chrome.tabs.create({ url: data.verification_uri_complete });
    }

    const deadline = Date.now() + (data.expires_in || 1800) * 1000;
    const interval = Math.max(5, data.interval || 5) * 1000;

    while (Date.now() < deadline) {
      await sleep(interval);
      const r = await fetch("https://enter.pollinations.ai/api/device/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_code: data.device_code })
      });
      const t = await r.json();
      if (t.access_token) {
        await chrome.storage.local.set({ polli_key: t.access_token });
        $("device").hidden = true;
        setConnected(true);
        setMsg("Connected. Select text on any page and stretch it.");
        return;
      }
      if (t.error && t.error !== "authorization_pending" && t.error !== "slow_down") {
        throw new Error(t.error_description || t.error);
      }
    }
    throw new Error("The code expired. Try again.");
  } catch (err) {
    $("device").hidden = true;
    setMsg(err.message || "Connection failed", true);
  } finally {
    polling = false;
    $("connect").disabled = false;
  }
}

async function disconnect() {
  await chrome.storage.local.remove("polli_key");
  setConnected(false);
  setMsg("Disconnected. The key can also be revoked in your Pollinations dashboard.");
}

async function saveModel() {
  const model = $("model").value.trim() || DEFAULT_MODEL;
  await chrome.storage.local.set({ model });
  setMsg(`Model saved: ${model}`);
}

$("connect").addEventListener("click", connect);
$("disconnect").addEventListener("click", disconnect);
$("save").addEventListener("click", saveModel);
refresh();
