import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bundle = await readFile(new URL("../assets/index-B2KJ37fm.js", import.meta.url), "utf8");

test("both existing canvas create menus expose text generation", () => {
    const connectionMenu = bundle.slice(bundle.indexOf("function zke("), bundle.indexOf("function eB("));
    const quickMenu = bundle.slice(bundle.indexOf("function kke("), bundle.indexOf("function G0("));

    assert.match(connectionMenu, /title:"\\u6587\\u672C\\u751F\\u6210"/);
    assert.match(connectionMenu, /onClick:\(\)=>t\("text-generation"\)/);
    assert.match(quickMenu, /label:"\\u6587\\u672C\\u751F\\u6210"/);
    assert.match(quickMenu, /onClick:\(\)=>t\("text-generation"\)/);
    assert.doesNotMatch(connectionMenu, /audio-input/);
    assert.doesNotMatch(quickMenu, /audio-input/);
});

test("double-click text generation creates a configured text node", () => {
    assert.match(
        bundle,
        /O==="text-generation"\)\{Lu\(Ne\.Text,"\\u6587\\u672C\\u751F\\u6210",K,\{content:"",prompt:"",status:rd,fontSize:14,model:ODe\(N,"text",N\.textModel\)\}\)/,
    );
});

test("connected text generation becomes reverse prompt for an image source", () => {
    assert.match(bundle, /isReverseText=O===Ne\.Text&&sourceNode\?\.type===Ne\.Image/);
    assert.match(bundle, /isReverseText\?\{reversePrompt:!0\}:\{\}/);
    assert.match(
        bundle,
        /title:isReverseText\?"\\u53CD\\u63A8\\u63D0\\u793A\\u8BCD":"\\u6587\\u672C\\u751F\\u6210"/,
    );
    assert.match(
        bundle,
        /O==="text-generation"\?c1\(Ne\.Text,Ge\):c1\(Ne\.Image,Ge\)/,
    );
    assert.match(bundle, /O!==Ne\.Audio&&ln\(le\.id\)/);
    assert.equal(
        bundle.match(/model:ODe\(N,"text",N\.textModel\)/g)?.length,
        3,
        "all canvas text-node creation paths should resolve the current site's text model",
    );
});

test("text-generation nodes do not expose the image-generation action", () => {
    assert.match(
        bundle,
        /\.\.\.fe&&!fX\(e\)&&e\.title!=="\\u6587\\u672C\\u751F\\u6210"\?\[\{id:"generateImage"/,
    );
    assert.match(
        bundle,
        /children:\[!fX\(e\)&&e\.title!=="\\u6587\\u672C\\u751F\\u6210"\?y\.jsxs\("button",\{type:"button",className:"absolute right-3 top-3/,
        "the inline image-generation button must also be hidden",
    );
});

test("reverse-prompt references remain connected and visible", () => {
    assert.match(
        bundle,
        /\.map\(st=>\(\{id:cn\(\),\.\.\.st\}\)\)/,
        "dragging from an image should create a normal visible connection",
    );
    assert.match(
        bundle,
        /fromNodeId:O\.id,toNodeId:Ee\.id\}/,
        "the toolbar reverse-prompt action should create a visible connection",
    );
    assert.match(bundle, /return!!\(K&&Q&&!aB\(K,B\)&&!aB\(Q,B\)/);
    assert.doesNotMatch(bundle, /!O\.hidden&&K&&Q/);
    assert.doesNotMatch(bundle, /!fX\(Q\)&&!aB\(K,B\)/);
});
