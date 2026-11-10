(() => {
  const app = window.ChatSpeedTrim = window.ChatSpeedTrim || {};
  const constants = app.constants;

  function isSupportedHost() {
    return constants.supportedHosts.has(window.location.hostname);
  }

  function mirrorSettingsToPage(settings) {
    const normalized = app.storage.normalizeSettings(settings);

    try {
      window.localStorage.setItem(constants.pageSettingsStorageKey, JSON.stringify(normalized));
    } catch (error) {
    console.warn("GPTlagfixer: failed to mirror settings to page storage.", error);
    }
  }

  async function initializeBootstrap() {
    if (!isSupportedHost()) {
      return;
    }

    // Chrome runs the MAIN-world hook directly from the manifest, before page scripts.
    mirrorSettingsToPage(await app.storage.ensureSettings());

    app.storage.onSettingsChanged((nextSettings) => {
      mirrorSettingsToPage(nextSettings);
    });
  }

  initializeBootstrap().catch((error) => {
    console.warn("GPTlagfixer: bootstrap failed.", error);
  });
})();
