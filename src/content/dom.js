(() => {
  const app = window.ChatSpeedTrim = window.ChatSpeedTrim || {};
  const constants = app.constants;

  const turnTestIdSelector = '[data-testid^="conversation-turn-"]';
  const authorRoleSelector = "[data-message-author-role]";
  const articleSelector = "article";

  function isSupportedPage(locationObject = window.location) {
    return constants.supportedHosts.has(locationObject.hostname);
  }

  function getChatRoot() {
    return document.querySelector("main");
  }

  function getConversationKey(pathname = window.location.pathname) {
    if (!isSupportedPage()) {
      return "unsupported";
    }

    const chatMatch = pathname.match(/\/c\/([^/?#]+)/);

    if (chatMatch) {
      return `c:${chatMatch[1]}`;
    }

    return pathname || "/";
  }

  function isTrimUiElement(element) {
    return Boolean(
      element &&
      element.nodeType === Node.ELEMENT_NODE &&
      element.hasAttribute(constants.uiAttribute)
    );
  }

  function sortInDocumentOrder(elements) {
    return [...elements].sort((left, right) => {
      if (left === right) {
        return 0;
      }

      const position = left.compareDocumentPosition(right);

      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1;
      }

      if (position & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1;
      }

      return 0;
    });
  }

  function uniqueTopLevel(elements) {
    const ordered = sortInDocumentOrder(
      elements.filter((element) => element && element.isConnected && !isTrimUiElement(element))
    );
    const unique = [];

    for (const element of ordered) {
      if (unique.some((existing) => existing.contains(element))) {
        continue;
      }

      unique.push(element);
    }

    return unique;
  }

  function isMeaningfulTurn(element) {
    if (!element || !element.isConnected || isTrimUiElement(element)) {
      return false;
    }

    const text = (element.textContent || "").trim();

    if (text.length > 0) {
      return true;
    }

    return Boolean(element.querySelector("img, svg, canvas, video, pre, code"));
  }

  function findBestTurnContainer(root, candidates) {
    const scoredAncestors = new Map();

    for (const candidate of candidates) {
      let current = candidate;

      while (current && current.parentElement) {
        const parent = current.parentElement;
        const existing = scoredAncestors.get(parent);

        if (existing) {
          existing.branches.add(current);
        } else {
          scoredAncestors.set(parent, {
            element: parent,
            branches: new Set([current]),
            depth: getDepth(parent, root)
          });
        }

        if (parent === root) {
          break;
        }

        current = parent;
      }
    }

    const candidatesWithBranches = [...scoredAncestors.values()].filter(
      (entry) => entry.branches.size >= 2
    );

    if (candidatesWithBranches.length === 0) {
      return null;
    }

    candidatesWithBranches.sort((left, right) => {
      if (right.branches.size !== left.branches.size) {
        return right.branches.size - left.branches.size;
      }

      return right.depth - left.depth;
    });

    return candidatesWithBranches[0].element;
  }

  function getDepth(node, stopNode) {
    let depth = 0;
    let current = node;

    while (current && current !== stopNode) {
      depth += 1;
      current = current.parentElement;
    }

    return depth;
  }

  function liftToDirectChild(root, element) {
    let current = element;

    while (current && current.parentElement && current.parentElement !== root) {
      current = current.parentElement;
    }

    return current || element;
  }

  function childContainsCandidate(child, candidates) {
    return candidates.some((candidate) => child === candidate || child.contains(candidate));
  }

  function inferTurnElementsFromCandidates(root, candidates) {
    if (candidates.length === 0) {
      return [];
    }

    const container = findBestTurnContainer(root, candidates);

    if (!container) {
      return uniqueTopLevel(
        candidates.map((candidate) => liftToDirectChild(root, candidate))
      ).filter(isMeaningfulTurn);
    }

    return uniqueTopLevel(
      [...container.children].filter(
        (child) => !isTrimUiElement(child) && childContainsCandidate(child, candidates)
      )
    ).filter(isMeaningfulTurn);
  }

  function collectMessageBlocks() {
    if (!isSupportedPage()) {
      return [];
    }

    const root = getChatRoot();

    if (!root) {
      return [];
    }

    const directTurns = uniqueTopLevel(
      [...root.querySelectorAll(turnTestIdSelector)]
    );

    if (directTurns.length >= 2) {
      return directTurns;
    }

    const authorTurns = inferTurnElementsFromCandidates(
      root,
      [...root.querySelectorAll(authorRoleSelector)].filter((element) => !isTrimUiElement(element))
    );

    if (authorTurns.length >= 2) {
      return authorTurns;
    }

    return inferTurnElementsFromCandidates(
      root,
      [...root.querySelectorAll(articleSelector)].filter((element) => !isTrimUiElement(element))
    );
  }

  function getTurnContainer(turns) {
    if (turns.length === 0) {
      return null;
    }

    const sharedParent = turns[0].parentElement;

    if (sharedParent && turns.every((turn) => turn.parentElement === sharedParent)) {
      return sharedParent;
    }

    const root = getChatRoot();
    return root ? findBestTurnContainer(root, turns) : null;
  }

  function buildTurnFingerprint(turns) {
    const tail = turns.slice(-3).map((turn) => {
      const text = (turn.textContent || "").trim().replace(/\s+/g, " ");
      const id = turn.getAttribute("data-testid") || turn.getAttribute("data-message-author-role") || "";
      return `${id}:${text.slice(0, 48)}`;
    }).join("|");

    return `${getConversationKey()}:${turns.length}:${tail}`;
  }

  app.dom = {
    isSupportedPage,
    getChatRoot,
    getConversationKey,
    isTrimUiElement,
    collectMessageBlocks,
    getTurnContainer,
    buildTurnFingerprint
  };
})();
