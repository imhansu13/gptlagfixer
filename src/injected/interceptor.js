(() => {
  if (window.__chatSpeedTrimInterceptorInstalled) {
    return;
  }
  window.__chatSpeedTrimInterceptorInstalled = true;

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

  // Metadata describes this document's actual responses, not a previous reload.
  // Keeping old counts here can cause phantom banners and reload loops when an
  // endpoint changes and no network trimming happens on the next visit.
  try {
    for (const key of Object.keys(window.sessionStorage)) {
      if (key.startsWith(KEYS.metaPrefix)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch (error) {
    // Storage may be unavailable; network handling must still fail open.
  }

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
      console.warn("GPTlagfixer: failed to write conversation metadata.", error);
    }
  }

  function clearConversationMeta(conversationKey) {
    try {
      window.sessionStorage.removeItem(`${KEYS.metaPrefix}${conversationKey}`);
    } catch (error) {
      console.warn("GPTlagfixer: failed to clear conversation metadata.", error);
    }
  }

  function isConversationRequest(url, method = "GET") {
    return method.toUpperCase() === "GET" &&
      ["chatgpt.com", "chat.openai.com"].includes(url.hostname) &&
      /\/backend-api\/(?:f\/)?conversation\/[^/]+\/?$/.test(url.pathname);
  }

  function getRequestConversationKey(url) {
    const id = url.pathname.match(/\/conversation\/([^/]+)\/?$/);
    return id ? `c:${id[1]}` : getConversationKey();
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

    if (nextId) {
      return []; // Broken or cyclic ancestry must never be rewritten.
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
    const conversationKey = getRequestConversationKey(requestUrl);
    const settings = refreshSettings();

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      !payload.mapping ||
      typeof payload.mapping !== "object" || Array.isArray(payload.mapping) ||
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

  function preserveResponseProperties(transformed, { url, redirected, type }) {
    // Capture primitives only. Holding the original Response in clone's closure
    // would also retain its untrimmed body and undermine the memory saving.
    const metadata = { url, redirected, type };
    for (const key of ["url", "redirected", "type"]) {
      Object.defineProperty(transformed, key, { value: metadata[key] });
    }
    const clone = transformed.clone.bind(transformed);
    Object.defineProperty(transformed, "clone", {
      value: () => preserveResponseProperties(clone(), metadata)
    });
    return transformed;
  }

  async function maybeTransformFetchResponse(input, init, response) {
    try {
      const requestUrl = new URL(input instanceof URL ? input.href :
        typeof input === "string" ? input : input.url, window.location.href);
      const method = init && init.method || input && input.method || "GET";
      const contentType = response.headers.get("content-type") || "";

      if (!isConversationRequest(requestUrl, method) || !response.ok ||
          contentType.includes("text/event-stream")) {
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

      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.delete("content-encoding");
      return preserveResponseProperties(new Response(JSON.stringify(result.payload), {
        status: response.status,
        statusText: response.statusText,
        headers
      }), response);
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
      return maybeTransformFetchResponse(args[0], args[1], response);
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
    const responseDescriptor = Object.getOwnPropertyDescriptor(prototype, "response");
    const textDescriptor = Object.getOwnPropertyDescriptor(prototype, "responseText");
    if (!responseDescriptor || !textDescriptor) {
      return;
    }
    const requests = new WeakMap();

    prototype.open = function patchedOpen(method, url, ...rest) {
      requests.set(this, {
        method,
        url: String(url),
        handled: false,
        result: null
      });

      return originalOpen.call(this, method, url, ...rest);
    };

    function readTransformedResponse(xhr) {
      const request = requests.get(xhr);
      if (!request || xhr.readyState !== 4) {
        return null;
      }
      if (request.handled) {
        return request.result;
      }
      request.handled = true;
      try {
        const url = new URL(request.url, window.location.href);
        if (!isConversationRequest(url, request.method) || xhr.status < 200 ||
            xhr.status >= 300 || !["", "text", "json"].includes(xhr.responseType)) {
          return null;
        }
        const payload = xhr.responseType === "json"
          ? responseDescriptor.get.call(xhr)
          : JSON.parse(textDescriptor.get.call(xhr));
        const result = trimConversationPayload(payload, url);
        if (result.changed) {
          request.result = { payload: result.payload, text: JSON.stringify(result.payload) };
        }
      } catch (error) {
        // Preserve the native response on unsupported or malformed data.
      }
      return request.result;
    }

    // Transform on first read, even when the page registered its ready-state
    // handler before open/send. A WeakMap also resets cleanly on XHR reuse.
    Object.defineProperty(prototype, "responseText", {
      ...textDescriptor,
      get() {
        const nativeText = textDescriptor.get.call(this);
        const result = readTransformedResponse(this);
        return result ? result.text : nativeText;
      }
    });
    Object.defineProperty(prototype, "response", {
      ...responseDescriptor,
      get() {
        const nativeResponse = responseDescriptor.get.call(this);
        const result = readTransformedResponse(this);
        return result ? (this.responseType === "json" ? result.payload : result.text) : nativeResponse;
      }
    });

    prototype.__chatSpeedTrimPatched = true;
  }

  patchFetch();
  patchXmlHttpRequest();
})();
