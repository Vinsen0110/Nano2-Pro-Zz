import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../prevent-canvas-drag-download.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("canvas native drag downloads are suppressed without breaking reference reordering", () => {
  assert.match(source, /addEventListener\(\s*"dragstart"/);
  assert.match(source, /closest\("\.node-element"\)/);
  assert.match(source, /closest\("\.canvas-reference-thumb"\)/);
  assert.match(source, /event\.preventDefault\(\)/);
});

test("canvas drag guard loads after the application bundle", () => {
  const bundleIndex = html.indexOf("index-B2KJ37fm.js");
  const guardIndex = html.indexOf("prevent-canvas-drag-download.js");
  assert.ok(bundleIndex >= 0);
  assert.ok(guardIndex > bundleIndex);
});
