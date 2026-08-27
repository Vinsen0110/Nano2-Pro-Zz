// Keep browser-native image dragging from turning canvas duplication into a download.
// The reference strip has its own intentional drag-and-drop ordering behavior.
window.addEventListener(
  "dragstart",
  (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(".node-element") || target.closest(".canvas-reference-thumb")) {
      return;
    }
    event.preventDefault();
  },
  true,
);
