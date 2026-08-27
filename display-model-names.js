const DISPLAY_NAME_MAP = new Map([
  ["gpt-image-2-vip", "gpt-image-2"],
]);
const DISPLAY_ICON_MAP = new Map([
  ["gemini-3.7-flash", "./icons/gemini.svg"],
]);

const MODEL_CONTAINER_SELECTOR = [
  ".canvas-composer-model-picker",
  ".canvas-model-picker",
  ".canvas-model-menu",
  ".settings-model-select",
  '[role="listbox"]',
].join(", ");

const MODEL_ITEM_SELECTOR = [
  ".canvas-composer-model-picker",
  ".canvas-model-picker",
  '.canvas-model-menu [role="option"]',
  ".settings-model-select",
  '[role="listbox"] [role="option"]',
].join(", ");

function iconForLabel(label) {
  const normalized = String(label || "").toLowerCase();
  for (const [model, icon] of DISPLAY_ICON_MAP) {
    if (normalized.includes(model)) return icon;
  }
  return "";
}

function ensureModelIcon(item, icon) {
  const image = item.querySelector("img");
  if (image) {
    if (image.getAttribute("src") !== icon) image.setAttribute("src", icon);
    return;
  }

  // The composer trigger can render a generic SVG fallback instead of an img.
  // Replace only the leading model icon, leaving the dropdown chevron intact.
  const fallback = item.querySelector('svg.size-4.shrink-0, svg[class*="size-4"][class*="shrink-0"]');
  if (!fallback) return;
  const replacement = document.createElement("img");
  replacement.src = icon;
  replacement.alt = "";
  replacement.className = "size-4 shrink-0";
  fallback.replaceWith(replacement);
}

function normalizeModelLabels(root = document) {
  const containers = root.querySelectorAll?.(
    MODEL_CONTAINER_SELECTOR,
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
    MODEL_ITEM_SELECTOR,
  ) || [];
  for (const item of modelItems) {
    const label = String(item.textContent || "").trim();
    const icon = iconForLabel(label);
    if (!icon) continue;
    ensureModelIcon(item, icon);
  }
}

normalizeModelLabels();
new MutationObserver(() => normalizeModelLabels()).observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true,
});
