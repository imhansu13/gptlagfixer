(() => {
  const app = window.ChatSpeedTrim = window.ChatSpeedTrim || {};

  app.constants = {
  extensionName: "GPTlagfixer",
    storageKey: "settings",
    pageSettingsStorageKey: "chat-speed-trim:page-settings",
    conversationMetaPrefix: "chat-speed-trim:meta:",
    revealStoragePrefix: "chat-speed-trim:reveal:",
    pageScriptAttribute: "data-chat-speed-trim-script",
    defaultEnabled: true,
    defaultKeepCount: 16,
    defaultLoadMoreCount: 20,
    minKeepCount: 4,
    maxKeepCount: 200,
    minLoadMoreCount: 5,
    maxLoadMoreCount: 200,
    donateUrl: "https://ko-fi.com/imhansu",
    supportedHosts: new Set(["chatgpt.com", "chat.openai.com"]),
    navigationEvent: "chat-speed-trim:navigation",
    uiAttribute: "data-chat-speed-trim-ui",
    placeholderAttributeValue: "placeholder",
    debounceMs: 650
  };
})();
