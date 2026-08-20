import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("gpt-image-2 generation panels widen without changing other model panels", () => {
    assert.match(
        indexHtml,
        /\.canvas-generation-panel:has\(\.canvas-model-select\[title\^="gpt-image-2"\]\) \{[^}]*width: min\(740px, calc\(100vw - 32px\)\) !important;[^}]*max-width: calc\(100vw - 32px\) !important;/s,
    );
});

test("gpt-image-2 toolbar can wrap when the viewport is narrow", () => {
    assert.match(
        indexHtml,
        /\.canvas-generation-panel:has\(\.canvas-model-select\[title\^="gpt-image-2"\]\) \.canvas-generation-toolbar \{[^}]*height: auto !important;[^}]*min-height: 48px;[^}]*flex-wrap: wrap;/s,
    );
    assert.match(
        indexHtml,
        /\.canvas-generation-toolbar > div:first-child \{[^}]*flex: 1 1 auto;[^}]*flex-wrap: wrap;/s,
    );
});

test("generation cost is larger and keeps tabular digits", () => {
    assert.match(
        indexHtml,
        /\.canvas-generation-toolbar \.canvas-generate-button \.bg-pink-100 \{[^}]*font-size: 12px !important;[^}]*font-weight: 800 !important;[^}]*font-variant-numeric: tabular-nums;/s,
    );
});
