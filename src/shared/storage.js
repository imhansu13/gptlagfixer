(() => {
  const app = window.ChatSpeedTrim = window.ChatSpeedTrim || {};
  const constants = app.constants;

  function clampKeepCount(value) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed)) {
      return constants.defaultKeepCount;
    }

    return Math.min(constants.maxKeepCount, Math.max(constants.minKeepCount, parsed));
  }

  function clampLoadMoreCount(value) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed)) {
      return constants.defaultLoadMoreCount;
    }

    return Math.min(constants.maxLoadMoreCount, Math.max(constants.minLoadMoreCount, parsed));
  }

  function normalizeSettings(rawSettings) {
    return {
      enabled: rawSettings && typeof rawSettings.enabled === "boolean"
        ? rawSettings.enabled
        : constants.defaultEnabled,
      keepCount: clampKeepCount(rawSettings && rawSettings.keepCount),
      loadMoreCount: clampLoadMoreCount(rawSettings && rawSettings.loadMoreCount)
    };
  }

  function readLocalStorage(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (items) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        resolve(items);
      });
    });
  }

  function writeLocalStorage(items) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        resolve();
      });
    });
  }

  async function getSettings() {
    const stored = await readLocalStorage([constants.storageKey]);
    return normalizeSettings(stored[constants.storageKey]);
  }

  async function saveSettings(partialSettings) {
    const current = await getSettings();
    const next = normalizeSettings({ ...current, ...partialSettings });

    await writeLocalStorage({
      [constants.storageKey]: next
    });

    return next;
  }

  async function ensureSettings() {
    const stored = await readLocalStorage([constants.storageKey]);
    const normalized = normalizeSettings(stored[constants.storageKey]);
    const needsWrite =
      !stored[constants.storageKey] ||
      stored[constants.storageKey].enabled !== normalized.enabled ||
      stored[constants.storageKey].keepCount !== normalized.keepCount ||
      stored[constants.storageKey].loadMoreCount !== normalized.loadMoreCount;

    if (needsWrite) {
      await writeLocalStorage({
        [constants.storageKey]: normalized
      });
    }

    return normalized;
  }

  function onSettingsChanged(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[constants.storageKey]) {
        return;
      }

      callback(normalizeSettings(changes[constants.storageKey].newValue));
    });
  }

  app.storage = {
    clampKeepCount,
    clampLoadMoreCount,
    normalizeSettings,
    getSettings,
    saveSettings,
    ensureSettings,
    onSettingsChanged
  };
})();
