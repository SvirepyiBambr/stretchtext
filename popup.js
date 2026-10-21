/* Stretchtext popup. */
const $ = (id) => document.getElementById(id);

async function refresh() {
  const { enabled, polli_key } = await chrome.storage.local.get(["enabled", "polli_key"]);
  $("enabled").checked = enabled !== false;
  $("dot").classList.toggle("on", Boolean(polli_key));
  $("statusText").textContent = polli_key ? "Pollen connected" : "Not connected";
}

$("enabled").addEventListener("change", (e) => {
  chrome.storage.local.set({ enabled: e.target.checked });
});

$("open").addEventListener("click", () => chrome.runtime.openOptionsPage());

refresh();
