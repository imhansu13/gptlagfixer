(() => {
  const app = window.ChatSpeedTrim = window.ChatSpeedTrim || {};
  const constants = app.constants;

  function isSupportedHost() {
    return constants.supportedHosts.has(window.location.hostname);
  }

  function injectPageScript() {
    if (!isSupportedHost()) {
      return;
    }

    if (document.querySelector(`[${constants.pageScriptAttribute}="interceptor"]`)) {
      return;
    }

    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("src/injected/interceptor.js");
    script.async = false;
    script.setAttribute(constants.pageScriptAttribute, "interceptor");

    const parent = document.documentElement || document.head || document.body;

    if (!parent) {
      return;
    }

    script.addEventListener("load", () => {
      script.remove();
    }, { once: true });

    parent.prepend(script);
  }

  function mirrorSettingsToPage(settings) {
    const normalized = app.storage.normalizeSettings(settings);

    try {
      window.localStorage.setItem(constants.pageSettingsStorageKey, JSON.stringify(normalized));
    } catch (error) {
      console.warn("ChatGPT Speed Trim: failed to mirror settings to page storage.", error);
    }
  }

  async function initializeBootstrap() {
    if (!isSupportedHost()) {
      return;
    }

    injectPageScript();
    mirrorSettingsToPage(await app.storage.ensureSettings());

    app.storage.onSettingsChanged((nextSettings) => {
      mirrorSettingsToPage(nextSettings);
    });
  }

  initializeBootstrap().catch((error) => {
    console.warn("ChatGPT Speed Trim: bootstrap failed.", error);
  });
})();
