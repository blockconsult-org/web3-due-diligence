import test from "node:test";
import assert from "node:assert/strict";
import { blankReview, parseReview, parseFile, parseDocument, safeEvidenceUrl, summarize, validationError, validDate, ModelError, MAX_FILE_BYTES } from "@/tools/web3-due-diligence/model";
import { checks, categories } from "@/tools/web3-due-diligence/catalog";
import { preset } from "@/tools/web3-due-diligence/presets";
import { makeSnapshot, encodeSnapshot, decodeSnapshot, HASH_PREFIX, MAX_ENCODED_LENGTH, MAX_DECODED_BYTES } from "@/tools/web3-due-diligence/codec";
import { summaryLines } from "@/tools/web3-due-diligence/export";
const noText = { projectName: false, notes: false, evidence: false };
const all = { projectName: true, notes: true, evidence: true };
const rawHash = value => HASH_PREFIX + Buffer.from(JSON.stringify(value)).toString("base64url");
const invalid = (review, code) => assert.throws(() => parseReview(review), e => e instanceof ModelError && e.code === code);

test("24 distinct bilingual checks evenly span all six categories", () => {
  assert.equal(checks.length, 24); assert.equal(new Set(checks.map(c => c.id)).size, 24);
  for (const category of categories) assert.equal(checks.filter(c => c.category === category.id).length, 4);
  for (const c of checks) for (const locale of ["en", "de"]) for (const key of ["title", "why", "evidence", "question"]) assert.ok(c[key][locale].length > 15);
});
test("all unknown stays unresolved with zero evidence and no low-risk verdict", () => {
  const s = summarize(blankReview());
  assert.deepEqual(s.overall, { total:24, applicable:24, excluded:0, evidence:0, assessed:0 });
  assert.equal(s.unresolved.length, 24); assert.equal(s.concerns.length, 0);
  assert.equal(s.score, undefined); assert.equal(s.risk, undefined);
  assert.match(summaryLines(blankReview(), "en").join("\n"), /does not establish low risk/);
});
test("critical concern remains despite 23 supported, reviewed sources", () => {
  const r = blankReview();
  r.entries.forEach(e => Object.assign(e, { state:"supported", url:"https://example.invalid/evidence", evidenceDate:"2026-10-01", verification:"reviewed" }));
  r.entries.find(e => e.id === "contracts-upgrade").state = "concern";
  const s = summarize(parseReview(r));
  assert.equal(s.critical.length, 1); assert.equal(s.questions[0].check.id, "contracts-upgrade"); assert.equal(s.unresolved.length, 1);
});
test("audit link never grants review status, remediation or privileged control support", () => {
  const r = blankReview(), e = r.entries.find(e => e.id === "audit-scope");
  Object.assign(e, { state:"supported", url:"https://example.invalid/audit" });
  assert.equal(parseReview(r).entries.find(e => e.id === "audit-scope").verification, "unreviewed");
  assert.equal(summarize(r).overall.evidence, 0); assert.equal(summarize(r).unresolved.length,24);
  for (const id of ["audit-remediation", "contracts-upgrade"]) assert.equal(r.entries.find(e => e.id === id).state,"unknown");
  e.verification="reviewed"; invalid(r,"verification");
});
test("dated sources count independently of assessment, but supported without self-review remains unresolved", () => {
  const r = blankReview(); Object.assign(r.entries[0], { state:"supported", url:"https://example.invalid", evidenceDate:"2026-10-01" });
  assert.equal(summarize(r).overall.evidence,1); assert.equal(summarize(r).unresolved.length,24);
  r.entries[0].verification="reviewed"; assert.equal(summarize(r).unresolved.length,23);
});
test("exclusions require reasons and change denominators transparently", () => {
  const r = preset("harbor", "en"); r.entries[0].state="na";
  invalid(r,"reason"); r.entries[0].exclusionReason="Outside review scope";
  const s = summarize(parseReview(r)); assert.equal(s.overall.applicable,23); assert.equal(s.overall.excluded,1); assert.equal(s.overall.total,24); assert.equal(s.overall.evidence,17);
  r.entries.forEach(e => Object.assign(e,{state:"na",exclusionReason:"Excluded by author"}));
  const x = summarize(parseReview(r)); assert.equal(x.overall.applicable,0); assert.equal(x.overall.evidence,0); assert.equal(x.excluded.length,24);
  assert.match(summaryLines(r,"en").join("\n"), /coverage is undefined/);
});
test("dates validate calendar days and evidence cannot postdate the review", () => {
  for (const date of ["2026-02-29","2026-13-01","2026-04-31","26-1-1","1999-01-01","2101-01-01"]) assert.equal(validDate(date), false, date);
  assert.equal(validDate("2024-02-29"),true);
  const r=blankReview(); r.reviewDate="2026-10-01"; r.entries[0].evidenceDate="2026-10-02"; invalid(r,"date");
  r.entries[0].evidenceDate="2026-09-30"; assert.equal(validationError(r),null);
});
test("URLs allow only complete HTTP(S), rejecting markup, credentials, schemes and incomplete input", () => {
  for (const url of ["javascript:alert(1)","data:text/html,hi","//example.com","example.com","https:","https://","https://a b","https://u:p@example.com","<img src=x onerror=alert(1)>","ftp://example.com"]) {
    assert.equal(safeEvidenceUrl(url),null,url); const r=blankReview(); r.entries[0].url=url; invalid(r,"url");
  }
  assert.equal(safeEvidenceUrl("https://example.com/path?q=hello#x"),"https://example.com/path?q=hello#x");
  assert.equal(safeEvidenceUrl("http://localhost:3000/x"),"http://localhost:3000/x");
});
test("wrong tool and all unsupported schema/methodology versions reject", () => {
  for (const patch of [{tool:"token-simulator"},{schemaVersion:2},{methodologyVersion:2},{schemaVersion:"1"},{methodologyVersion:NaN},{schemaVersion:Infinity}]) invalid({...blankReview(),...patch},"version");
});
test("malformed imports reject duplicate, missing, extra checks, wrong enums, types and oversized text", () => {
  const cases=[null,[],{},42,"hi"];
  for (const x of cases) assert.throws(()=>parseDocument(x));
  const r=blankReview();
  for (const entries of [r.entries.slice(1),[...r.entries,r.entries[0]],r.entries.map((e,i)=>i===1?r.entries[0]:e),r.entries.map((e,i)=>i===1?{...e,state:"safe"}:e),r.entries.map((e,i)=>i===1?{...e,note:5}:e)]) assert.throws(()=>parseReview({...r,entries}));
  r.entries[0].note="x".repeat(2001); invalid(r,"length");
  assert.throws(()=>parseReview({...blankReview(),projectName:"a".repeat(121)}));
  assert.throws(()=>parseFile("{")); assert.throws(()=>parseFile(" ".repeat(MAX_FILE_BYTES+1)));
  assert.throws(()=>parseReview({...blankReview(), extra:"ignored?"}));
  assert.throws(()=>parseFile(JSON.stringify(blankReview()).replace('"kind":"review"','"__proto__":{"polluted":true},"kind":"review"'))); assert.equal({}.polluted,undefined);
});
test("all localized presets validate and contrast evidence gaps", () => {
  for (const locale of ["en","de"]) for (const name of ["blank","harbor","orbit"]) assert.deepEqual(parseReview(preset(name,locale)),preset(name,locale));
  assert.equal(summarize(preset("harbor","en")).overall.evidence,18);
  assert.equal(summarize(preset("orbit","en")).overall.evidence,0);
  assert.equal(summarize(preset("orbit","en")).critical.length,4);
});
test("all eight sharing choices round-trip and actually omit excluded fields", () => {
  const r=preset("harbor","de"); r.projectName="Secret name 😀"; r.assessor="Secret assessor"; r.purpose="Secret purpose"; r.conclusion="Secret conclusion"; r.entries[0].note="Secret note";
  r.entries[3].state="na"; r.entries[3].exclusionReason="Secret reason";
  for (let i=0;i<8;i++) {
    const options={projectName:!!(i&1),notes:!!(i&2),evidence:!!(i&4)};
    const snap=makeSnapshot(r,options), encoded=encodeSnapshot(snap), decoded=decodeSnapshot(encoded);
    assert.deepEqual(decoded,snap);
    const bytes=Buffer.from(encoded.slice(HASH_PREFIX.length),"base64url").toString("utf8");
    assert.equal(bytes.includes("Secret name"),options.projectName);
    for (const word of ["Secret assessor","Secret purpose","Secret conclusion","Secret note","Secret reason"]) assert.equal(bytes.includes(word),options.notes,word);
    for (const word of ['"url"','"evidenceDate"',"https://example.invalid"]) assert.equal(bytes.includes(word),options.evidence,word);
    const summary=summaryLines(snap.review,"en",snap).join("\n");
    if(!options.projectName) assert.ok(!summary.includes("Secret name"));
    if(!options.notes) for (const word of ["Secret assessor","Secret purpose","Secret conclusion","Secret note","Secret reason"]) assert.ok(!summary.includes(word));
    if(!options.evidence) assert.ok(!summary.includes("example.invalid"));
  }
});
test("redacted report distinguishes creator completion from included evidence, including per category", () => {
  const snap=makeSnapshot(preset("harbor","en"),noText), s=summarize(snap.review);
  assert.equal(snap.reported.overall.evidence,18); assert.equal(s.overall.evidence,0);
  assert.equal(snap.reported.categories.contracts.evidence,3); assert.equal(s.categories.contracts.evidence,0);
  assert.equal(s.unresolved.length,24); assert.equal(s.critical.length,1);
  assert.match(summaryLines(snap.review,"en",snap).join("\n"),/Creator-reported dated evidence: 18\/24 · Included here: 0\/24/);
});
test("redaction flags cannot conceal supplied fields or forged evidence totals", () => {
  const snap=makeSnapshot(preset("harbor","en"),noText);
  for (const mutate of [s=>s.review.projectName="secret",s=>s.review.entries[0].url="https://secret.invalid",s=>s.review.entries[0].note="secret",s=>s.reported.overall.evidence=25,s=>s.reported.overall.evidence=NaN,s=>s.reported.categories.team.evidence=0,s=>s.includes.notes="false"]) {
    const s=structuredClone(snap);mutate(s);assert.throws(()=>parseDocument(s));assert.equal(decodeSnapshot(rawHash(s)),null);
  }
});
test("full model export retains editable evidence, notes and hostile text as inert strings", () => {
  const r=preset("harbor","en");r.projectName='<script>alert("x")</script>';r.entries[0].note='<img src=x onerror="alert(1)">';
  assert.deepEqual(parseFile(JSON.stringify(r)),r);
  assert.deepEqual(decodeSnapshot(encodeSnapshot(makeSnapshot(r,all))).review,r);
});
test("the full file cap accommodates the largest permitted editable text, including JSON escapes", () => {
  const r=blankReview();
  Object.assign(r,{projectName:"字".repeat(120),assessor:"字".repeat(120),purpose:"\u0000".repeat(500),conclusion:"\u0000".repeat(2000)});
  r.entries.forEach(e=>Object.assign(e,{note:"\u0000".repeat(2000),exclusionReason:"\u0000".repeat(500),url:"https://example.invalid/"+"字".repeat(2000)}));
  const json=JSON.stringify(r);assert.ok(Buffer.byteLength(json)<MAX_FILE_BYTES);assert.deepEqual(parseFile(json),r);
});
test("codec rejects wrong prefixes, corrupt UTF-8/base64, unsupported payloads and both size bounds", () => {
  for(const hash of ["", "#dd2=abc", HASH_PREFIX, HASH_PREFIX+"+/=", HASH_PREFIX+"a", HASH_PREFIX+Buffer.from([255]).toString("base64url"), rawHash(blankReview()), rawHash({}), HASH_PREFIX+"A".repeat(MAX_ENCODED_LENGTH+1)]) assert.equal(decodeSnapshot(hash),null);
  const snap=makeSnapshot(blankReview(),all);snap.schemaVersion=2;assert.equal(decodeSnapshot(rawHash(snap)),null);
  const r=blankReview();r.entries.forEach(e=>e.note="a".repeat(2000));const big=makeSnapshot(r,all);
  assert.ok(Buffer.byteLength(JSON.stringify(big))>MAX_DECODED_BYTES);assert.throws(()=>encodeSnapshot(big));assert.equal(decodeSnapshot(rawHash(big)),null);
});
