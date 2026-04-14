(() => {
  const app = window.ChatSpeedTrim;
  let keepCountSaveTimer = null;
  let loadMoreSaveTimer = null;

  const statusMessages = {
    idle: "Saved locally.",
    saving: "Saving...",
    saved: "Saved locally.",
    error: "Could not save right now."
  };

  function setStatus(text) {
    const statusEl = document.getElementById("statusText");
    if (statusEl) {
      statusEl.textContent = text;
    }
  }

  function populateKeepCount(settings) {
    const input = document.getElementById("keepCount");
    if (!input) {
      return;
    }

    input.value = String(settings.keepCount);
  }

  function populateLoadMoreCount(settings) {
    const input = document.getElementById("loadMoreCount");
    if (!input) {
      return;
    }

    input.value = String(settings.loadMoreCount);
  }

  function populateEnabled(settings) {
    const toggle = document.getElementById("enabledToggle");
    if (!toggle) {
      return;
    }

    toggle.checked = Boolean(settings.enabled);
  }

  function populateSettings(settings) {
    populateEnabled(settings);
    populateKeepCount(settings);
    populateLoadMoreCount(settings);
    populateResetButton(settings);
  }

  function populateResetButton(settings) {
    const button = document.getElementById("resetCurrentChatButton");
    if (!button) {
      return;
    }

    button.textContent = `Reset to ${settings.keepCount} visible`;
  }

  function queryActiveTab() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        resolve(tabs && tabs[0] ? tabs[0] : null);
      });
    });
  }

  function sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        resolve(response);
      });
    });
  }

  async function saveSettings(partialSettings) {
    setStatus(statusMessages.saving);

    try {
      const nextSettings = await app.storage.saveSettings(partialSettings);
      populateSettings(nextSettings);
      setStatus(statusMessages.saved);
    } catch (error) {
      console.warn("ChatGPT Speed Trim: failed to save popup settings.", error);
      setStatus(statusMessages.error);
    }
  }

  async function initializePopup() {
    const input = document.getElementById("keepCount");
    const loadMoreInput = document.getElementById("loadMoreCount");
    const toggle = document.getElementById("enabledToggle");
    const resetButton = document.getElementById("resetCurrentChatButton");

    if (!input || !loadMoreInput || !toggle || !resetButton) {
      return;
    }

    const settings = await app.storage.ensureSettings();
    populateSettings(settings);
    setStatus(statusMessages.idle);

    toggle.addEventListener("change", async (event) => {
      await saveSettings({ enabled: event.target.checked });
    });

    input.addEventListener("change", async (event) => {
      await saveSettings({ keepCount: app.storage.clampKeepCount(event.target.value) });
    });

    input.addEventListener("input", (event) => {
      window.clearTimeout(keepCountSaveTimer);
      keepCountSaveTimer = window.setTimeout(() => {
        saveSettings({ keepCount: app.storage.clampKeepCount(event.target.value) }).catch((error) => {
          console.warn("ChatGPT Speed Trim: popup autosave failed.", error);
        });
      }, 220);
    });

    input.addEventListener("blur", async (event) => {
      await saveSettings({ keepCount: app.storage.clampKeepCount(event.target.value) });
    });

    loadMoreInput.addEventListener("change", async (event) => {
      await saveSettings({ loadMoreCount: app.storage.clampLoadMoreCount(event.target.value) });
    });

    loadMoreInput.addEventListener("input", (event) => {
      window.clearTimeout(loadMoreSaveTimer);
      loadMoreSaveTimer = window.setTimeout(() => {
        saveSettings({
          loadMoreCount: app.storage.clampLoadMoreCount(event.target.value)
        }).catch((error) => {
          console.warn("ChatGPT Speed Trim: popup autosave failed.", error);
        });
      }, 220);
    });

    loadMoreInput.addEventListener("blur", async (event) => {
      await saveSettings({ loadMoreCount: app.storage.clampLoadMoreCount(event.target.value) });
    });

    resetButton.addEventListener("click", async () => {
      setStatus("Resetting current chat...");

      try {
        const activeTab = await queryActiveTab();

        if (!activeTab || typeof activeTab.id !== "number") {
          setStatus("Open a ChatGPT chat tab first.");
          return;
        }

        await sendMessageToTab(activeTab.id, {
          type: "chat-speed-trim:reset-current-chat"
        });

        setStatus("Reset sent to current chat.");
      } catch (error) {
        console.warn("ChatGPT Speed Trim: failed to reset current chat.", error);
        setStatus("Open a ChatGPT chat tab to reset it.");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initializePopup().catch((error) => {
        console.warn("ChatGPT Speed Trim: popup initialization failed.", error);
      });
    }, { once: true });
  } else {
    initializePopup().catch((error) => {
      console.warn("ChatGPT Speed Trim: popup initialization failed.", error);
    });
  }
})();
