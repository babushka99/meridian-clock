// Toolbar click → open World Time Ruler in its own active tab. No popup, no New Tab override.
chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('index.html'), active: true });
});
