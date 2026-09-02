import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("generation panels resize from the outer frame in both axes", () => {
    assert.match(
        indexHtml,
        /\.canvas-generation-panel \{[^}]*position: relative;[^}]*display: flex;[^}]*flex-direction: column;[^}]*min-width: 660px;[^}]*min-height: 0;[^}]*max-width: calc\(100vw - 32px\) !important;[^}]*resize: none !important;[^}]*overflow: visible !important;/s,
    );
    assert.match(
        indexHtml,
        /\.canvas-generation-panel > \.relative\.h-full\.w-full \{[^}]*display: flex;[^}]*flex-direction: column;[^}]*flex: 1 1 auto;[^}]*min-height: 0;[^}]*height: auto !important;/s,
    );
    assert.match(indexHtml, /--canvas-panel-resize-width/);
    assert.match(indexHtml, /--canvas-panel-resize-height/);
    assert.match(indexHtml, /document\.addEventListener\("pointerdown", beginResize, true\)/);
    assert.match(indexHtml, /window\.addEventListener\("pointerup", finishResize, true\)/);
});

test("prompt editors no longer expose an inner resize handle", () => {
    assert.match(
        indexHtml,
        /\.canvas-generation-panel\[data-canvas-resize-ready="true"\] textarea,[\s\S]*?\.canvas-generation-panel\[data-canvas-resize-ready="true"\] \[contenteditable="true"\] \{[^}]*flex: 1 1 auto;[^}]*height: auto !important;[^}]*max-height: none !important;[^}]*resize: none !important;/s,
    );
});

test("parameter controls keep fixed widths and stay on one row", () => {
    assert.match(
        indexHtml,
        /\.canvas-generation-toolbar \{[^}]*height: 48px !important;[^}]*min-height: 48px;[^}]*flex-wrap: nowrap;[^}]*align-content: center;[^}]*overflow: visible;/s,
    );
    assert.match(
        indexHtml,
        /\.canvas-generation-toolbar > div:first-child \{[^}]*flex: 0 0 auto;[^}]*flex-wrap: nowrap;/s,
    );
    assert.match(
        indexHtml,
        /\.canvas-generation-toolbar > div:last-child \{[^}]*margin-left: auto !important;/s,
    );
    assert.match(
        indexHtml,
        /\.canvas-generation-toolbar \.canvas-model-select,[\s\S]*?\.canvas-generation-toolbar \.canvas-prompt-preset-select \{[^}]*flex: 0 0 auto;/s,
    );
});
