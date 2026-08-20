import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("generation panels resize from the outer frame in both axes", () => {
    assert.match(
        indexHtml,
        /\.canvas-generation-panel \{[^}]*position: relative;[^}]*display: flex;[^}]*flex-direction: column;[^}]*min-width: 220px;[^}]*min-height: 0;[^}]*max-width: calc\(100vw - 32px\) !important;[^}]*resize: none !important;[^}]*overflow: visible !important;/s,
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

test("parameter controls keep their widths while the toolbar adapts spacing", () => {
    assert.match(
        indexHtml,
        /\.canvas-generation-toolbar \{[^}]*height: auto !important;[^}]*min-height: 48px;[^}]*flex-wrap: wrap;[^}]*align-content: center;/s,
    );
    assert.match(
        indexHtml,
        /\.canvas-generation-toolbar \.canvas-model-select,[\s\S]*?\.canvas-generation-toolbar \.canvas-prompt-preset-select \{[^}]*flex: 0 0 auto;/s,
    );
});
