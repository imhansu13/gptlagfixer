(() => {
  const app = window.ChatSpeedTrim = window.ChatSpeedTrim || {};
  const constants = app.constants;

  function createPlaceholder(onLoadMore) {
    const wrapper = document.createElement("div");
    wrapper.setAttribute(constants.uiAttribute, constants.placeholderAttributeValue);
    wrapper.className = "cst-placeholder";

    const summary = document.createElement("p");
    summary.className = "cst-placeholder__summary";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cst-placeholder__button";
    button.addEventListener("click", onLoadMore);

    wrapper.append(summary, button);
    wrapper._summaryEl = summary;
    wrapper._buttonEl = button;

    return wrapper;
  }

  function updatePlaceholder(placeholder, hiddenCount, loadCount) {
    if (!placeholder) {
      return;
    }

    const noun = hiddenCount === 1 ? "message" : "messages";
    const summary = placeholder._summaryEl || placeholder.querySelector(".cst-placeholder__summary");
    const button = placeholder._buttonEl || placeholder.querySelector(".cst-placeholder__button");

    if (summary) {
      summary.textContent = `${hiddenCount} earlier ${noun} hidden to keep this chat fast.`;
    }

    if (button) {
      const loadNoun = loadCount === 1 ? "message" : "messages";
      button.textContent = `Load ${loadCount} more ${loadNoun}`;
    }
  }

  function mountPlaceholder(placeholder, container, beforeNode) {
    if (!placeholder || !container) {
      return;
    }

    if (beforeNode && beforeNode.parentElement === container) {
      container.insertBefore(placeholder, beforeNode);
      return;
    }

    container.prepend(placeholder);
  }

  function removePlaceholder(placeholder) {
    if (placeholder && placeholder.isConnected) {
      placeholder.remove();
    }
  }

  app.ui = {
    createPlaceholder,
    updatePlaceholder,
    mountPlaceholder,
    removePlaceholder
  };
})();
