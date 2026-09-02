import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bundle = await readFile(new URL("../assets/index-B2KJ37fm.js", import.meta.url), "utf8");

function arraySlice(startToken, endToken) {
  const start = bundle.indexOf(startToken);
  const end = bundle.indexOf(endToken, start);
  assert.ok(start >= 0 && end > start, `${startToken} should be present`);
  return bundle.slice(start, end);
}

test("ratio labels stay compact and the selector reserves the checkmark column", () => {
  for (const [start, end] of [
    ["J2e=[", "],e$e="],
    ["pX=[", "],ike="],
    ["NANO_PRO_RATIO_PRESETS=[", "],pg="],
    ["GPT_IMAGE_EXTRA_RATIO_PRESETS=[", "];const LOCAL_IMAGE_PROMPT_PRESETS="],
  ]) {
    const ratios = arraySlice(start, end);
    assert.doesNotMatch(ratios, /label:"[^\"]*\\u(?:6A2A|7AD6|6B63|624B|7535|8D85)/);
  }
  assert.match(bundle, /function ratioShape\(\{/);
  assert.match(bundle, /i=o\/a,l=i>=1\?16:Math\.max\(7,Math\.round\(16\*i\)\),d=i>=1\?Math\.max\(7,Math\.round\(16\/i\)\):16/);
  assert.match(bundle, /borderWidth:1\.25/);
  assert.match(bundle, /showRatioShape:s=!1/);
  assert.match(bundle, /className:"h-8 min-w-0 rounded-lg px-2 pr-8 text-xs"/);
  assert.match(bundle, /min-w-0 flex-1 truncate whitespace-nowrap text-left/);
  assert.match(bundle, /widthClass:"w-\[124px\]"/);
});

test("reverse image prompt panel supports the built-in preset and explicit disable", () => {
  assert.match(bundle, /id:"builtin-image-reverse",label:"\\u56FE\\u7247\\u53CD\\u63A8",prompt:W0/);
  assert.match(bundle, /function lke\([^)]*promptPresetId:promptPresetId/);
  assert.match(bundle, /y\.jsx\(LocalImagePromptPresetSelect,\{value:promptPresetId/);
  assert.match(bundle, /promptPresetId:e\.metadata\?\.localPromptPresetId\?\?"builtin-image-reverse"/);
  assert.match(bundle, /localPromptPresetId:"builtin-image-reverse"/);
  assert.match(bundle, /currentPrompt=String\(P\|\|""\)\.trim\(\)/);
  assert.match(bundle, /if\(!z\)\{if\(x&&currentPrompt&&currentPrompt===previousPrompt\)\{\$\(""\),n\(e\.id,""\)\}return\}/);
  assert.match(bundle, /e\.metadata\?\.prompt\?\?\(e\.metadata\?\.localPromptPresetId===""\?"":W0\)/);
  assert.match(bundle, /e\.metadata\?\.localPromptPresetId\]\);/);
  assert.match(bundle, /localPromptPresetId:e\.metadata\?\.localPromptPresetId\?\?"builtin-image-reverse",prompt:e\.metadata\?\.prompt\?\?bg/);
});

test("built-in presets include the layer separation prompt", () => {
  assert.match(
    bundle,
    /id:"builtin-separate-layers",label:"\\u5206\\u79BB\\u56FE\\u5C42",prompt:"\\u5206\\u79BB\\u56FE\\u4E2D\\u7684\\u6240\\u6709\\u5143\\u7D20\\uFF0C\\u4FDD\\u6301\\u539F\\u59CB\\u5143\\u7D20\\u7684\\u539F\\u59CB\\u4F4D\\u7F6E\\u4E0D\\u53D8\\uFF0C\\u7EC6\\u8282\\u6E05\\u6670\\uFF0C\\u8D85\\u6E05\\uFF0C8K",builtin:!0/,
  );
});

test("settings ratio select renders the same compact ratio shape", () => {
  assert.match(bundle, /optionRender:\$=>y\.jsxs\("span",\{className:"flex min-w-0 items-center gap-2",children:\[ratioShape\(\{value:\$\.value\}\)/);
  assert.match(bundle, /labelRender:\$=>y\.jsxs\("span",\{className:"flex min-w-0 items-center gap-2",children:\[ratioShape\(\{value:\$\.value\}\)/);
});
