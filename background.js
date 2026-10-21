/* Stretchtext background service worker: context menu + options wiring. */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "stretchtext-selection",
    title: "Stretch this text",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "stretchtext-selection" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "stretch-selection" }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "open-options") {
    chrome.runtime.openOptionsPage();
  }
});
