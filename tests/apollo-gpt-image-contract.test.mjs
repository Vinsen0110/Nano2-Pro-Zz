import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const bundle = fs.readFileSync(new URL("../assets/index-B2KJ37fm.js", import.meta.url), "utf8");

test("Apollo exposes GPT Image 2 as an image model", () => {
    assert.match(bundle, /APOLLO_IMAGE_MODELS=\["nano-banana-pro","gpt-image-2"\]/);
    assert.match(bundle, /APOLLO_SITE_MODELS=\["nano-banana-pro-2k","nano-banana-pro-4k","nano-banana-pro","gpt-image-2"/);
});

test("Apollo GPT Image 2 keeps request model and resolution mapping isolated", () => {
    assert.match(bundle, /function isApolloGptImageModel\(e\)/);
    assert.match(bundle, /function apolloGptImageRequestModel\(\)\{return"gpt-image-2"\}/);
    assert.match(bundle, /model:apolloGptImageRequestModel\(e\),prompt:Zq\(e,t\),size:apolloGptImageSize\(e\),quality:tudouQuality\(e\)/);
    assert.match(bundle, /t==="auto"\?816:t==="1k"\?1024:t==="2k"\?2048:2880/);
    assert.match(bundle, /Math\.sqrt\(i\*a\).*Math\.sqrt\(i\/a\)/);
    assert.match(bundle, /for\(;m\*h>TMe;\).*for\(;m\*h<MMe;\)/);
});

test("Apollo GPT Image 2 uses the RH quality and extended ratio controls", () => {
    assert.match(bundle, /isGptImageModel=pr\(e\.model\)==="gpt-image-2"&&\(isApilioSite\(e\)\|\|isTudouSite\(e\)\|\|isRunningHubSite\(e\)/);
    assert.match(bundle, /ratioPresets=orderRatioPresets\(isGptImageModel\?\[\.\.\.pg,\.\.\.GPT_IMAGE_EXTRA_RATIO_PRESETS\]/);
    assert.match(bundle, /GPT_IMAGE_QUALITY_OPTIONS\.map\(k=>y\.jsx\(GL/);
});

test("Apollo GPT Image 2 shows quality in the compact canvas toolbar", () => {
    assert.match(bundle, /isGptImageConfig=\["gpt-image-2","gpt-image-2-vip"\]\.includes\(pr\(a\.imageModel\|\|a\.model\)\)&&\["apilio","tudou","runninghub","grsai"\]\.includes/);
    assert.match(bundle, /u=Array\.isArray\(t\.channels\)\?bd\(t,t\.model\):t/);
    assert.match(bundle, /isApilioSite\(u\)\|\|isTudouSite\(u\)\|\|isRunningHubSite\(u\)\|\|isGrsaiSite\(u\)/);
    assert.match(bundle, /v\?y\.jsx\(n\$,\{value:w,items:GPT_IMAGE_QUALITY_OPTIONS/);
});

test("Apollo GPT Image 2 always submits async generations and edits", () => {
    assert.match(bundle, /submitImageRequest\(e,n\.length\?"\/images\/edits":"\/images\/generations",i,n\.length\?wA\(e\):wA\(e,"application\/json"\),o,!0,a,!0\)/);
    assert.match(bundle, /if\(j\|\|!imageAsyncUnsupported\(h\)\)throw h/);
    assert.match(bundle, /`\$\{isTudouSite\(e\)\?"\/tasks":"\/images\/tasks"\}\//);
});

test("Apollo GPT Image 2 edits send the documented multipart fields", () => {
    assert.match(bundle, /r\.set\("model",apolloGptImageRequestModel\(e\)\),r\.set\("prompt",Zq\(e,t\)\),r\.set\("size",apolloGptImageSize\(e\)\),r\.set\("quality",tudouQuality\(e\)\)/);
    assert.match(bundle, /isApolloGptImageModel\(a\.model\).*nM\(\{\.\.\.h,dataUrl:await vh\(h\)\}\)/);
});

test("Apollo keeps billing metadata per key and never changes the request model", () => {
    assert.match(bundle, /from"\.\.\/apollo-billing\.js"/);
    assert.match(bundle, /billingGroup:normalizeApolloBillingGroup\(n\?\.billingGroup\)/);
    assert.match(bundle, /detectedBillingGroup:normalizeApolloDetectedBillingGroup\(n\?\.detectedBillingGroup\)/);
    assert.match(bundle, /apolloBillingKey:activeSiteApiKey\(n\)/);
    assert.match(bundle, /i&&n==="gpt-image-2"\?apolloGptImagePrice/);
    assert.match(bundle, /children:"GPT Image 2 计费组"/);
    assert.match(bundle, /children:"重新检测"/);
    assert.match(bundle, /children:"待确认"/);
    assert.match(bundle, /\(\?:普通\|default\).*\(\?:优质\|premium\|official\).*\?"label"/);
    assert.match(bundle, /function assertApolloNanoBilling\(e\)/);
    assert.match(bundle, /effectiveApolloBillingGroup\(e\.apolloBillingKey\)===APOLLO_BILLING_GROUP_DEFAULT/);
    assert.match(bundle, /function apolloGptImageRequestModel\(\)/, "resolution routing must stay outside billing metadata");
    assert.doesNotMatch(bundle, /model:"gpt-image-2-official-mix"/);
});
