(() => {
  const app = window.ChatSpeedTrim = window.ChatSpeedTrim || {};
  const constants = app.constants;

  const state = {
    placeholderEl: null,
    turnContainer: null,
    conversationKey: "",
    isApplying: false,
    lastVisibleFingerprint: "",
    lastHiddenCount: 0,
    lastEffectiveKeepCount: 0,
    loadMoreCount: constants.defaultLoadMoreCount,
    hiddenCount: 0
  };

  function clearRecordedState() {
    state.lastVisibleFingerprint = "";
    state.lastHiddenCount = 0;
    state.lastEffectiveKeepCount = 0;
  }

  function removePlaceholder() {
    if (state.placeholderEl) {
      app.ui.removePlaceholder(state.placeholderEl);
    }

    state.placeholderEl = null;
  }

  function getRevealStorageKey(conversationKey) {
    return `${constants.revealStoragePrefix}${conversationKey}`;
  }

  function getRevealOffset(conversationKey) {
    const rawValue = window.sessionStorage.getItem(getRevealStorageKey(conversationKey));
    const parsed = Number.parseInt(rawValue || "0", 10);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return parsed;
  }

  function setRevealOffset(conversationKey, value) {
    const normalized = Math.max(0, Number.parseInt(value, 10) || 0);

    if (normalized === 0) {
      window.sessionStorage.removeItem(getRevealStorageKey(conversationKey));
      return;
    }

    window.sessionStorage.setItem(getRevealStorageKey(conversationKey), String(normalized));
  }

  function removeNodes(nodes) {
    for (const node of nodes) {
      if (node && node.parentElement) {
        node.remove();
      }
    }
  }

  function getMetaStorageKey(conversationKey) {
    return `${constants.conversationMetaPrefix}${conversationKey}`;
  }

  function getConversationMeta(conversationKey) {
    try {
      const rawValue = window.sessionStorage.getItem(getMetaStorageKey(conversationKey));

      if (!rawValue) {
        return null;
      }

      const parsed = JSON.parse(rawValue);

      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      const hiddenCount = Number.parseInt(parsed.hiddenCount, 10);
      const totalVisibleCount = Number.parseInt(parsed.totalVisibleCount, 10);
      const effectiveKeepCount = Number.parseInt(parsed.effectiveKeepCount, 10);

      return {
        source: parsed.source || "unknown",
        hiddenCount: Number.isFinite(hiddenCount) && hiddenCount > 0 ? hiddenCount : 0,
        totalVisibleCount: Number.isFinite(totalVisibleCount) && totalVisibleCount > 0
          ? totalVisibleCount
          : 0,
        effectiveKeepCount: Number.isFinite(effectiveKeepCount) && effectiveKeepCount > 0
          ? effectiveKeepCount
          : 0
      };
    } catch (error) {
      return null;
    }
  }

  function clearConversationMeta(conversationKey) {
    try {
      window.sessionStorage.removeItem(getMetaStorageKey(conversationKey));
    } catch (error) {
      console.warn("ChatGPT Speed Trim: failed to clear conversation metadata.", error);
    }
  }

  function ensurePlaceholder(container, beforeNode, hiddenCount) {
    if (!state.placeholderEl) {
      state.placeholderEl = app.ui.createPlaceholder(handleLoadMoreClick);
    }

    app.ui.updatePlaceholder(
      state.placeholderEl,
      hiddenCount,
      Math.min(state.loadMoreCount, hiddenCount)
    );
    app.ui.mountPlaceholder(state.placeholderEl, container, beforeNode);
  }

  function resetConversationState() {
    removePlaceholder();
    state.turnContainer = null;
    state.conversationKey = "";
    state.hiddenCount = 0;
    clearRecordedState();
  }

  function recordSnapshot(visibleTurns, effectiveKeepCount) {
    state.lastVisibleFingerprint = app.dom.buildTurnFingerprint(visibleTurns);
    state.lastHiddenCount = state.hiddenCount;
    state.lastEffectiveKeepCount = effectiveKeepCount;
  }

  function needsEarlyExit(visibleTurns, effectiveKeepCount) {
    const nextFingerprint = app.dom.buildTurnFingerprint(visibleTurns);

    return (
      state.lastVisibleFingerprint &&
      state.lastVisibleFingerprint === nextFingerprint &&
      state.lastHiddenCount === state.hiddenCount &&
      state.lastEffectiveKeepCount === effectiveKeepCount
    );
  }

  function reloadPage() {
    window.location.reload();
  }

  function handleLoadMoreClick() {
    const conversationKey = state.conversationKey || app.dom.getConversationKey();

    if (!conversationKey || conversationKey === "unsupported") {
      return;
    }

    const nextOffset = getRevealOffset(conversationKey) + state.loadMoreCount;
    setRevealOffset(conversationKey, nextOffset);
    reloadPage();
  }

  function resetToBaseView() {
    const conversationKey = state.conversationKey || app.dom.getConversationKey();

    if (!conversationKey || conversationKey === "unsupported") {
      return false;
    }

    setRevealOffset(conversationKey, 0);
    clearConversationMeta(conversationKey);
    reloadPage();
    return true;
  }

  async function apply(settings, options = {}) {
    const { forceReset = false } = options;

    if (state.isApplying || !app.dom.isSupportedPage()) {
      return;
    }

    state.isApplying = true;

    try {
      const conversationKey = app.dom.getConversationKey();
      const pathChanged = state.conversationKey && state.conversationKey !== conversationKey;

      if (pathChanged) {
        resetConversationState();
      } else if (forceReset) {
        clearRecordedState();
        state.turnContainer = null;
      }

      state.conversationKey = conversationKey;
      state.loadMoreCount = settings.loadMoreCount;

      if (!settings.enabled) {
        if (state.hiddenCount > 0 || state.placeholderEl) {
          setRevealOffset(conversationKey, 0);
          clearConversationMeta(conversationKey);
          reloadPage();
          return;
        }

        removePlaceholder();
        return;
      }

      let visibleTurns = app.dom.collectMessageBlocks();

      if (visibleTurns.length === 0) {
        return;
      }

      const container = app.dom.getTurnContainer(visibleTurns);

      if (!container) {
        return;
      }

      state.turnContainer = container;

      const effectiveKeepCount = settings.keepCount + getRevealOffset(conversationKey);
      const conversationMeta = getConversationMeta(conversationKey);

      if (
        conversationMeta &&
        conversationMeta.source === "network" &&
        conversationMeta.effectiveKeepCount > 0 &&
        effectiveKeepCount > conversationMeta.effectiveKeepCount
      ) {
        reloadPage();
        return;
      }

      if (!forceReset && needsEarlyExit(visibleTurns, effectiveKeepCount)) {
        return;
      }

      const baseHiddenCount = conversationMeta
        ? conversationMeta.hiddenCount
        : state.hiddenCount;
      const totalTurns = conversationMeta && conversationMeta.totalVisibleCount > 0
        ? conversationMeta.totalVisibleCount
        : visibleTurns.length + baseHiddenCount;
      const desiredHiddenCount = Math.max(0, totalTurns - effectiveKeepCount);

      if (desiredHiddenCount < baseHiddenCount) {
        reloadPage();
        return;
      }

      const additionalToHide = desiredHiddenCount - baseHiddenCount;

      if (additionalToHide > 0) {
        removeNodes(visibleTurns.slice(0, additionalToHide));
        visibleTurns = visibleTurns.slice(additionalToHide);
      }

      state.hiddenCount = desiredHiddenCount;

      if (state.hiddenCount === 0) {
        removePlaceholder();
        recordSnapshot(visibleTurns, effectiveKeepCount);
        return;
      }

      if (visibleTurns.length === 0) {
        clearRecordedState();
        return;
      }

      ensurePlaceholder(container, visibleTurns[0], desiredHiddenCount);
      recordSnapshot(visibleTurns, effectiveKeepCount);
    } finally {
      state.isApplying = false;
    }
  }

  app.prune = {
    apply,
    hardReset: resetConversationState,
    resetToBaseView,
    state
  };
})();
