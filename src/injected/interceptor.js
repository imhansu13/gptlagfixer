(() => {
  const DEFAULTS = {
    enabled: true,
    keepCount: 16
  };

  const KEYS = {
    settings: "chat-speed-trim:page-settings",
    metaPrefix: "chat-speed-trim:meta:",
    revealPrefix: "chat-speed-trim:reveal:"
  };

  const state = {
    settings: readSettingsFromStorage()
  };

  function normalizeSettings(rawSettings) {
    const keepCount = Number.parseInt(rawSettings && rawSettings.keepCount, 10);

    return {
      enabled: rawSettings && typeof rawSettings.enabled === "boolean"
        ? rawSettings.enabled
        : DEFAULTS.enabled,
      keepCount: Number.isFinite(keepCount) && keepCount > 0
        ? keepCount
        : DEFAULTS.keepCount
    };
  }

  function readSettingsFromStorage() {
    try {
      const raw = window.localStorage.getItem(KEYS.settings);
      return normalizeSettings(raw ? JSON.parse(raw) : null);
    } catch (error) {
      return { ...DEFAULTS };
    }
  }

  function refreshSettings() {
    state.settings = readSettingsFromStorage();
    return state.settings;
  }

  function getConversationKey(pathname = window.location.pathname) {
    const match = pathname.match(/\/c\/([^/?#]+)/);

    if (match) {
      return `c:${match[1]}`;
    }

    return pathname || "/";
  }

  function getRevealOffset(conversationKey) {
    try {
      const rawValue = window.sessionStorage.getItem(`${KEYS.revealPrefix}${conversationKey}`);
      const parsed = Number.parseInt(rawValue || "0", 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch (error) {
      return 0;
    }
  }

  function writeConversationMeta(conversationKey, meta) {
    try {
      window.sessionStorage.setItem(
        `${KEYS.metaPrefix}${conversationKey}`,
        JSON.stringify(meta)
      );
    } catch (error) {
      console.warn("ChatGPT Speed Trim: failed to write conversation metadata.", error);
    }
  }

  function clearConversationMeta(conversationKey) {
    try {
      window.sessionStorage.removeItem(`${KEYS.metaPrefix}${conversationKey}`);
    } catch (error) {
      console.warn("ChatGPT Speed Trim: failed to clear conversation metadata.", error);
    }
  }

  function isConversationRequest(url) {
    return /\/conversation\//.test(url.pathname) && !/\/conversations\b/.test(url.pathname);
  }

  function isRenderableTurn(node) {
    const message = node && node.message;
    const role = String(message && message.author && message.author.role || "").toLowerCase();

    if (!message || message.metadata && message.metadata.is_visually_hidden_from_conversation) {
      return false;
    }

    if (role === "system" || role === "tool") {
      return false;
    }

    return true;
  }

  function buildCurrentChain(mapping, currentNodeId) {
    const chain = [];
    const visited = new Set();
    let nextId = currentNodeId;

    while (nextId && mapping[nextId] && !visited.has(nextId)) {
      visited.add(nextId);
      chain.push(nextId);
      nextId = mapping[nextId].parent || null;
    }

    return chain.reverse();
  }

  function countRenderableTurns(chainIds, mapping) {
    let count = 0;

    for (const id of chainIds) {
      if (isRenderableTurn(mapping[id])) {
        count += 1;
      }
    }

    return count;
  }

  function findVisibleStartIndex(chainIds, mapping, keepCount) {
    let visibleSeen = 0;

    for (let index = chainIds.length - 1; index >= 0; index -= 1) {
      if (isRenderableTurn(mapping[chainIds[index]])) {
        visibleSeen += 1;
      }

      if (visibleSeen >= keepCount) {
        return index;
      }
    }

    return 0;
  }

  function shouldKeepAnchor(chainIds, mapping, startIndex) {
    if (startIndex <= 0 || chainIds.length === 0) {
      return false;
    }

    return !isRenderableTurn(mapping[chainIds[0]]);
  }

  function cloneNode(node) {
    if (!node || typeof node !== "object") {
      return node;
    }

    return {
      ...node,
      message: node.message && typeof node.message === "object"
        ? {
            ...node.message,
            author: node.message.author && typeof node.message.author === "object"
              ? { ...node.message.author }
              : node.message.author,
            content: node.message.content && typeof node.message.content === "object"
              ? { ...node.message.content }
              : node.message.content,
            metadata: node.message.metadata && typeof node.message.metadata === "object"
              ? { ...node.message.metadata }
              : node.message.metadata
          }
        : node.message,
      children: Array.isArray(node.children) ? [...node.children] : []
    };
  }

  function trimConversationPayload(payload, requestUrl) {
    const conversationKey = getConversationKey();
    const settings = refreshSettings();

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      !payload.mapping ||
      typeof payload.mapping !== "object" ||
      !payload.current_node
    ) {
      return { payload, changed: false };
    }

    if (!settings.enabled) {
      clearConversationMeta(conversationKey);
      return { payload, changed: false };
    }

    const effectiveKeepCount = settings.keepCount + getRevealOffset(conversationKey);
    const chainIds = buildCurrentChain(payload.mapping, payload.current_node);

    if (chainIds.length === 0) {
      clearConversationMeta(conversationKey);
      return { payload, changed: false };
    }

    const totalRenderableTurns = countRenderableTurns(chainIds, payload.mapping);
    const hiddenCount = Math.max(0, totalRenderableTurns - effectiveKeepCount);

    writeConversationMeta(conversationKey, {
      source: "network",
      hiddenCount,
      totalVisibleCount: totalRenderableTurns,
      effectiveKeepCount,
      updatedAt: Date.now()
    });

    if (hiddenCount === 0) {
      return { payload, changed: false };
    }

    const startIndex = findVisibleStartIndex(chainIds, payload.mapping, effectiveKeepCount);
    const suffixIds = chainIds.slice(startIndex);
    const anchorId = shouldKeepAnchor(chainIds, payload.mapping, startIndex)
      ? chainIds[0]
      : null;
    const keepIds = anchorId ? [anchorId, ...suffixIds] : [...suffixIds];
    const keepSet = new Set(keepIds);
    const nextMapping = {};

    for (const id of keepIds) {
      const original = payload.mapping[id];

      if (!original) {
        continue;
      }

      nextMapping[id] = cloneNode(original);
    }

    for (const id of keepIds) {
      const entry = nextMapping[id];

      if (!entry) {
        continue;
      }

      entry.children = (entry.children || []).filter((childId) => keepSet.has(childId));
    }

    if (suffixIds.length > 0) {
      const firstVisibleId = suffixIds[0];
      const firstVisibleEntry = nextMapping[firstVisibleId];

      if (firstVisibleEntry) {
        if (anchorId) {
          firstVisibleEntry.parent = anchorId;

          if (nextMapping[anchorId]) {
            nextMapping[anchorId].parent = null;
            nextMapping[anchorId].children = [firstVisibleId];
          }
        } else {
          firstVisibleEntry.parent = null;
        }
      }
    }

    return {
      payload: {
        ...payload,
        mapping: nextMapping
      },
      changed: true
    };
  }

  async function maybeTransformFetchResponse(input, response) {
    try {
      const requestUrl = new URL(typeof input === "string" ? input : input.url, window.location.href);

      if (!isConversationRequest(requestUrl)) {
        return response;
      }

      const clonedResponse = response.clone();
      const responseText = await clonedResponse.text();

      if (!responseText) {
        return response;
      }

      const payload = JSON.parse(responseText);
      const result = trimConversationPayload(payload, requestUrl);

      if (!result.changed) {
        return response;
      }

      return new Response(JSON.stringify(result.payload), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      return response;
    }
  }

  function patchFetch() {
    if (typeof window.fetch !== "function") {
      return;
    }

    if (window.fetch.__chatSpeedTrimPatched) {
      return;
    }

    const originalFetch = window.fetch;

    async function patchedFetch(...args) {
      const response = await originalFetch.apply(this, args);
      return maybeTransformFetchResponse(args[0], response);
    }

    patchedFetch.__chatSpeedTrimPatched = true;
    window.fetch = patchedFetch;
  }

  function patchXmlHttpRequest() {
    const prototype = window.XMLHttpRequest && window.XMLHttpRequest.prototype;

    if (!prototype || prototype.__chatSpeedTrimPatched) {
      return;
    }

    const originalOpen = prototype.open;
    const originalSend = prototype.send;

    prototype.open = function patchedOpen(method, url, ...rest) {
      this.__chatSpeedTrimRequest = {
        method,
        url: typeof url === "string" ? url : String(url)
      };

      return originalOpen.call(this, method, url, ...rest);
    };

    prototype.send = function patchedSend(...args) {
      const request = this.__chatSpeedTrimRequest;

      if (!request) {
        return originalSend.apply(this, args);
      }

      const requestUrl = new URL(request.url, window.location.href);

      if (!isConversationRequest(requestUrl)) {
        return originalSend.apply(this, args);
      }

      this.addEventListener("readystatechange", () => {
        if (this.readyState !== 4 || this.__chatSpeedTrimHandled) {
          return;
        }

        this.__chatSpeedTrimHandled = true;

        try {
          const rawText = this.responseType === "" || this.responseType === "text"
            ? this.responseText
            : JSON.stringify(this.response);

          if (!rawText) {
            return;
          }

          const payload = JSON.parse(rawText);
          const result = trimConversationPayload(payload, requestUrl);

          if (!result.changed) {
            return;
          }

          const transformedText = JSON.stringify(result.payload);

          Object.defineProperty(this, "responseText", {
            configurable: true,
            get() {
              return transformedText;
            }
          });

          Object.defineProperty(this, "response", {
            configurable: true,
            get() {
              if (this.responseType === "" || this.responseType === "text") {
                return transformedText;
              }

              return result.payload;
            }
          });
        } catch (error) {
          console.warn("ChatGPT Speed Trim: XHR trim failed.", error);
        }
      });

      return originalSend.apply(this, args);
    };

    prototype.__chatSpeedTrimPatched = true;
  }

  patchFetch();
  patchXmlHttpRequest();
})();
