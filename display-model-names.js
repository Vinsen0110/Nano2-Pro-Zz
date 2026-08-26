const DISPLAY_NAME_MAP = new Map([
  ["gpt-image-2-vip", "gpt-image-2"],
]);
const DISPLAY_ICON_MAP = new Map([
  ["gemini-3.7-flash", "./icons/gemini.svg"],
]);

function normalizeModelLabels(root = document) {
  const containers = root.querySelectorAll?.(
    ".canvas-model-picker, .canvas-model-menu, .settings-model-select, [role=\"listbox\"]",
  ) || [];
  for (const container of containers) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const value = String(node.nodeValue || "");
      const trimmed = value.trim();
      const displayName = DISPLAY_NAME_MAP.get(trimmed);
      if (!displayName) continue;
      node.nodeValue = value.replace(trimmed, displayName);
    }
  }

  const modelItems = root.querySelectorAll?.(
    ".canvas-model-picker, .canvas-model-menu [role=\"option\"], .settings-model-select, [role=\"listbox\"] [role=\"option\"]",
  ) || [];
  for (const item of modelItems) {
    const label = String(item.textContent || "").trim();
    const icon = DISPLAY_ICON_MAP.get(label);
    if (!icon) continue;
    for (const image of item.querySelectorAll("img")) {
      if (image.getAttribute("src") !== icon) image.setAttribute("src", icon);
    }
  }
}

normalizeModelLabels();
new MutationObserver(() => normalizeModelLabels()).observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true,
});
