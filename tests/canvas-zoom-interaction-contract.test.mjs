import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bundle = await readFile(new URL("../assets/index-B2KJ37fm.js", import.meta.url), "utf8");
const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("panel resize capture leaves low-zoom controls clickable", () => {
    assert.match(indexHtml, /var interactiveTarget = event\.target instanceof Element &&[\s\S]*?closest\("button, input, textarea, select, \[contenteditable=\\"true\\"\]"\);[\s\S]*?if \(interactiveTarget\) return;/);
    assert.match(indexHtml, /var edgeX = Math\.min\(edgeSize, Math\.max\(4, metrics\.rect\.width \* 0\.2\)\);/);
    assert.match(indexHtml, /var edgeY = Math\.min\(edgeSize, Math\.max\(4, metrics\.rect\.height \* 0\.2\)\);/);
});

test("text canvas nodes use the same default frame as image nodes", () => {
    assert.match(
        bundle,
        /\[Ne\.Image\]:\{width:560,height:400,title:"New Generation"\},\[Ne\.Text\]:\{width:560,height:400,title:"Note"\}/,
    );
});
