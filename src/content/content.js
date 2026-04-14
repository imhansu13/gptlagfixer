(() => {
  const app = window.ChatSpeedTrim = window.ChatSpeedTrim || {};
  const constants = app.constants;

  const runtimeState = {
    settings: null,
    observer: null,
    debounceTimer: null,
    observerTarget: null
  };

  function hookHistoryNavigation() {
    if (window.__chatSpeedTrimHistoryHooked) {
      return;
    }

    window.__chatSpeedTrimHistoryHooked = true;

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function pushStateWrapper(...args) {
      const result = originalPushState.apply(this, args);
      document.dispatchEvent(new CustomEvent(constants.navigationEvent));
      return result;
    };

    history.replaceState = function replaceStateWrapper(...args) {
      const result = originalReplaceState.apply(this, args);
      document.dispatchEvent(new CustomEvent(constants.navigationEvent));
      return result;
    };
  }

  function scheduleApply(options = {}) {
    if (!runtimeState.settings) {
      return;
    }

    window.clearTimeout(runtimeState.debounceTimer);
    runtimeState.debounceTimer = window.setTimeout(() => {
      app.prune.apply(runtimeState.settings, options).catch((error) => {
        console.warn("ChatGPT Speed Trim: failed to apply pruning.", error);
      }).finally(() => {
        startObserver();
      });
    }, constants.debounceMs);
  }

  function isTrimUiNode(node) {
    if (!node) {
      return false;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      return Boolean(node.closest(`[${constants.uiAttribute}]`));
    }

    if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
      return Boolean(node.parentElement.closest(`[${constants.uiAttribute}]`));
    }

    return false;
  }

  function hasRelevantMutation(mutations) {
    return mutations.some((mutation) => {
      if (isTrimUiNode(mutation.target)) {
        return false;
      }

      const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];

      if (changedNodes.length === 0) {
        return mutation.type === "childList";
      }

      return changedNodes.some((node) => !isTrimUiNode(node));
    });
  }

  function resolveObserverTarget() {
    const turns = app.dom.collectMessageBlocks();
    const turnContainer = app.dom.getTurnContainer(turns);

    if (turnContainer) {
      return turnContainer;
    }

    return app.dom.getChatRoot() || document.body;
  }

  function startObserver() {
    const nextTarget = resolveObserverTarget();

    if (!nextTarget) {
      return;
    }

    if (runtimeState.observer && runtimeState.observerTarget === nextTarget) {
      return;
    }

    if (runtimeState.observer) {
      runtimeState.observer.disconnect();
    }

    runtimeState.observer = new MutationObserver((mutations) => {
      if (!hasRelevantMutation(mutations)) {
        return;
      }

      scheduleApply({ reason: "mutation" });
    });

    runtimeState.observer.observe(nextTarget, {
      childList: true,
      subtree: true
    });

    runtimeState.observerTarget = nextTarget;
  }

  async function initialize() {
    runtimeState.settings = await app.storage.ensureSettings();

    hookHistoryNavigation();
    startObserver();

    app.storage.onSettingsChanged((nextSettings) => {
      runtimeState.settings = nextSettings;
      runtimeState.observerTarget = null;
      scheduleApply({ reason: "settings", forceReset: true });
    });

    document.addEventListener(constants.navigationEvent, () => {
      runtimeState.observerTarget = null;
      scheduleApply({ reason: "navigation", forceReset: true });
    });

    window.addEventListener("popstate", () => {
      runtimeState.observerTarget = null;
      scheduleApply({ reason: "popstate", forceReset: true });
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        scheduleApply({ reason: "visible" });
      }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || message.type !== "chat-speed-trim:reset-current-chat") {
        return;
      }

      const didReset = Boolean(app.dom.isSupportedPage());
      sendResponse({ ok: didReset });
      if (didReset) {
        window.setTimeout(() => {
          app.prune.resetToBaseView();
        }, 0);
      }
      return true;
    });

    scheduleApply({ reason: "init", forceReset: true });
    window.setTimeout(() => scheduleApply({ reason: "late-init" }), 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initialize().catch((error) => {
        console.warn("ChatGPT Speed Trim: initialization failed.", error);
      });
    }, { once: true });
  } else {
    initialize().catch((error) => {
      console.warn("ChatGPT Speed Trim: initialization failed.", error);
    });
  }
})();
