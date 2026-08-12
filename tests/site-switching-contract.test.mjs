import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bundle = await readFile(new URL("../assets/index-B2KJ37fm.js", import.meta.url), "utf8");
const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("settings site tabs only change the site being edited", () => {
    assert.match(bundle, /\[configSiteId,setConfigSiteId\]=c\.useState\(null\)/);
    assert.match(
        bundle,
        /k=\$=>\{setEditingKeyId\(null\),setKeyMenuOpen\(!1\),setConfigSiteId\(\$\)\}/,
    );
    assert.doesNotMatch(
        bundle,
        /k=\$=>\{setEditingKeyId\(null\),setKeyMenuOpen\(!1\);const j=buildSiteConfigPatch/,
    );
    assert.match(
        bundle,
        /j!==void 0&&v===a\.activeSiteId\?\{apiKey:j\}:\{\}/,
        "editing an inactive site must not replace the active top-level API key",
    );
});

test("the bottom-left control exposes explicit site choices", () => {
    assert.match(bundle, /className:"canvas-site-menu",role:"menu"/);
    assert.match(bundle, /role:"menuitemradio","aria-checked":f\.id===activeSite\?\.id/);
    assert.match(bundle, /onClick:\(\)=>selectSite\(f\.id\)/);
    assert.match(
        bundle,
        /selectSite=f=>\{const m=buildSiteConfigPatch\(siteConfig,f\);m&&\(patchSiteConfig\(m\),setSiteMenuOpen\(!1\)\)\}/,
    );
    assert.doesNotMatch(bundle, /switchSite=\(\)=>/);
    assert.match(indexHtml, /\.canvas-site-menu-item\.is-active/);
});

test("the current canvas site name has stronger visual emphasis", () => {
    assert.match(
        bundle,
        /className:"canvas-site-current-label","aria-live":"polite",children:\["\\u5F53\\u524D\\uFF1A",y\.jsx\("strong"/,
    );
    assert.match(indexHtml, /\.canvas-site-current-label strong \{[^}]*font-weight: 800/s);
    assert.match(indexHtml, /index-B2KJ37fm\.js\?v=20260812-36/);
});

test("the lower-left toolbar only shows site, minimap, and zoom controls", () => {
    assert.match(
        indexHtml,
        /\.canvas-site-switch-button ~ button\[aria-label="快捷键"\][^}]*display: none !important;/s,
    );
    assert.match(indexHtml, /body:has\(\.canvas-site-switch-button:hover\) \.ant-tooltip,[^}]*display: none !important;/s);
    assert.match(indexHtml, /body:has\(\.canvas-site-menu\) \.ant-tooltip \{[^}]*display: none !important;/s);
});

test("generation defaults identify the active site and use a readable select state", () => {
    assert.match(
        bundle,
        /label:`\\u9ED8\\u8BA4\\u6A21\\u578B\\uFF08\$\{activeSiteChannel\(a\)\?\.name/,
    );
    assert.match(bundle, /popupClassName:"settings-select-dropdown"/);
    assert.match(
        indexHtml,
        /\.settings-select-dropdown \.ant-select-item-option-selected[^}]*background: #eaf2ff !important;[^}]*color: #175cd3 !important;/s,
    );
    assert.match(
        indexHtml,
        /\.settings-select\.ant-select-open \.ant-select-selector \.ant-select-selection-item[^}]*color: #1f2937 !important;[^}]*-webkit-text-fill-color: #1f2937 !important;[^}]*opacity: 1 !important;/s,
    );
    assert.match(
        indexHtml,
        /\.dark \.settings-select-dropdown[^}]*background: #1c1917 !important;[^}]*color: #e7e5e4 !important;/s,
    );
});
