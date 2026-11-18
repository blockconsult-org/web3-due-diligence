import { categories, checks, type Category } from "./catalog";
export const TOOL = "web3-due-diligence" as const;
export const SCHEMA_VERSION = 1;
export const METHODOLOGY_VERSION = 1;
export const STORAGE_KEY = "bc-web3-due-diligence:v1";
// Accommodates all 24 maximally sized editable entries, including JSON escapes.
export const MAX_FILE_BYTES = 1_000_000;
export const states = ["unknown", "supported", "concern", "na"] as const;
export const verifications = ["unreviewed", "reviewed"] as const;
export type State = typeof states[number];
export type Verification = typeof verifications[number];
export interface Entry {
  id: string; state: State; verification: Verification;
  url?: string; note?: string; evidenceDate?: string; exclusionReason?: string;
}
export interface Review {
  tool: typeof TOOL; schemaVersion: 1; methodologyVersion: 1; kind: "review";
  projectName?: string; purpose?: string; assessor?: string; conclusion?: string;
  reviewDate: string; entries: Entry[];
}
export interface ShareOptions { projectName: boolean; notes: boolean; evidence: boolean }
export interface Coverage { total: number; applicable: number; excluded: number; evidence: number; assessed: number }
export interface Snapshot {
  tool: typeof TOOL; schemaVersion: 1; methodologyVersion: 1; kind: "snapshot";
  review: Review; includes: ShareOptions;
  reported: { overall: Coverage; categories: Record<Category, Coverage> };
}
export type Document = Review | Snapshot;
export type ErrorCode = "format" | "version" | "date" | "url" | "reason" | "verification" | "length";
export class ModelError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode) { super(code); this.code = code; }
}
const fail = (code: ErrorCode): never => { throw new ModelError(code); };
function record(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x)) return fail("format");
  return x as Record<string, unknown>;
}
function exact(o: Record<string, unknown>, keys: string[]) {
  if (Object.keys(o).some(k => !keys.includes(k))) fail("format");
}
function text(x: unknown, max: number): string | undefined {
  if (x === undefined) return undefined;
  if (typeof x !== "string") return fail("format");
  if (x.length > max) return fail("length");
  return x;
}
export function validDate(value: string): boolean {
  return /^(20\d\d|2100)-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function safeEvidenceUrl(value: string | undefined): string | null {
  if (!value || value.length > 2048 || /\s/.test(value) || !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function versions(o: Record<string, unknown>) {
  if (o.tool !== TOOL || o.schemaVersion !== SCHEMA_VERSION || o.methodologyVersion !== METHODOLOGY_VERSION) fail("version");
}
export function parseReview(raw: unknown, redaction?: ShareOptions): Review {
  const o = record(raw); versions(o);
  exact(o, ["tool", "schemaVersion", "methodologyVersion", "kind", "projectName", "purpose", "assessor", "conclusion", "reviewDate", "entries"]);
  if (o.kind !== "review" || typeof o.reviewDate !== "string") fail("format");
  if (o.reviewDate !== "" && !validDate(o.reviewDate as string)) fail("date");
  const projectName = text(o.projectName, 120), purpose = text(o.purpose, 500), assessor = text(o.assessor, 120), conclusion = text(o.conclusion, 2000);
  if (!Array.isArray(o.entries) || o.entries.length !== checks.length) return fail("format");
  const seen = new Set<string>();
  const entries = o.entries.map((rawEntry): Entry => {
    const e = record(rawEntry);
    exact(e, ["id", "state", "verification", "url", "note", "evidenceDate", "exclusionReason"]);
    if (typeof e.id !== "string" || !checks.some(c => c.id === e.id) || seen.has(e.id)) return fail("format");
    seen.add(e.id);
    if (!states.includes(e.state as State) || !verifications.includes(e.verification as Verification)) return fail("format");
    const url = text(e.url, 2048), note = text(e.note, 2000), evidenceDate = text(e.evidenceDate, 10), exclusionReason = text(e.exclusionReason, 500);
    if (url && !safeEvidenceUrl(url)) fail("url");
    if (evidenceDate && (!validDate(evidenceDate) || (!!o.reviewDate && evidenceDate > (o.reviewDate as string)))) fail("date");
    if (e.state === "na" && redaction?.notes !== false && !exclusionReason?.trim()) fail("reason");
    if (e.verification === "reviewed" && (!url || !evidenceDate)) fail("verification");
    if (redaction?.evidence === false && ("url" in e || "evidenceDate" in e || e.verification !== "unreviewed")) fail("format");
    if (redaction?.notes === false && ("note" in e || "exclusionReason" in e)) fail("format");
    return { id: e.id, state: e.state as State, verification: e.verification as Verification,
      ...(url !== undefined && { url }), ...(note !== undefined && { note }), ...(evidenceDate !== undefined && { evidenceDate }), ...(exclusionReason !== undefined && { exclusionReason }) };
  });
  if (redaction?.projectName === false && "projectName" in o) fail("format");
  if (redaction?.notes === false && ["purpose", "assessor", "conclusion"].some(k => k in o)) fail("format");
  return { tool: TOOL, schemaVersion: 1, methodologyVersion: 1, kind: "review", reviewDate: o.reviewDate as string,
    ...(projectName !== undefined && { projectName }), ...(purpose !== undefined && { purpose }), ...(assessor !== undefined && { assessor }), ...(conclusion !== undefined && { conclusion }), entries };
}
export function hasEvidence(e: Entry): boolean { return !!safeEvidenceUrl(e.url) && !!e.evidenceDate && validDate(e.evidenceDate); }
export function coverage(entries: Entry[]): Coverage {
  const applicable = entries.filter(e => e.state !== "na");
  return { total: entries.length, applicable: applicable.length, excluded: entries.length - applicable.length,
    evidence: applicable.filter(hasEvidence).length, assessed: applicable.filter(e => e.state !== "unknown").length };
}
export function summarize(review: Review) {
  const byId = new Map(review.entries.map(e => [e.id, e]));
  const rows = checks.map(check => ({ check, entry: byId.get(check.id)! }));
  const rank = { critical: 0, high: 1, standard: 2 };
  const unresolved = rows.filter(({ entry: e }) => e.state !== "na" && (e.state !== "supported" || !hasEvidence(e) || e.verification !== "reviewed"));
  const concerns = rows.filter(r => r.entry.state === "concern").sort((a,b) => rank[a.check.priority] - rank[b.check.priority]);
  const questions = [...unresolved].sort((a,b) => Number(b.entry.state === "concern") - Number(a.entry.state === "concern") || rank[a.check.priority] - rank[b.check.priority]);
  return { overall: coverage(review.entries), categories: Object.fromEntries(categories.map(c => [c.id, coverage(rows.filter(r => r.check.category === c.id).map(r => r.entry))])) as Record<Category,Coverage>,
    concerns, critical: concerns.filter(r => r.check.priority === "critical"), unresolved, questions, excluded: rows.filter(r => r.entry.state === "na") };
}
function parseCoverage(raw: unknown, expected: Coverage, includesEvidence: boolean): Coverage {
  const o = record(raw); exact(o, ["total", "applicable", "excluded", "evidence", "assessed"]);
  for (const k of ["total", "applicable", "excluded", "evidence", "assessed"] as const) {
    if (typeof o[k] !== "number" || !Number.isSafeInteger(o[k]) || (o[k] as number) < 0 || (o[k] as number) > expected.total) fail("format");
  }
  const c = o as unknown as Coverage;
  if (c.total !== expected.total || c.applicable !== expected.applicable || c.excluded !== expected.excluded || c.assessed !== expected.assessed || c.evidence > c.applicable || (includesEvidence && c.evidence !== expected.evidence)) fail("format");
  return { ...c };
}
export function parseDocument(raw: unknown): Document {
  const o = record(raw);
  if (o.kind !== "snapshot") return parseReview(raw);
  versions(o); exact(o, ["tool", "schemaVersion", "methodologyVersion", "kind", "review", "includes", "reported"]);
  const inc = record(o.includes); exact(inc, ["projectName", "notes", "evidence"]);
  if ([inc.projectName, inc.notes, inc.evidence].some(v => typeof v !== "boolean")) return fail("format");
  const includes = inc as unknown as ShareOptions;
  const review = parseReview(o.review, includes);
  const summary = summarize(review);
  const rep = record(o.reported); exact(rep, ["overall", "categories"]);
  const cats = record(rep.categories); exact(cats, categories.map(c => c.id));
  const reportedCategories = Object.fromEntries(categories.map(c => [c.id, parseCoverage(cats[c.id], summary.categories[c.id], includes.evidence)])) as Record<Category,Coverage>;
  const overall = parseCoverage(rep.overall, summary.overall, includes.evidence);
  if (categories.reduce((n,c) => n + reportedCategories[c.id].evidence, 0) !== overall.evidence) fail("format");
  return { tool: TOOL, schemaVersion: 1, methodologyVersion: 1, kind: "snapshot", review, includes: { ...includes }, reported: { overall, categories: reportedCategories } };
}
export function parseFile(value: string): Document {
  if (new TextEncoder().encode(value).length > MAX_FILE_BYTES) return fail("length");
  try { return parseDocument(JSON.parse(value)); } catch (e) { if (e instanceof ModelError) throw e; return fail("format"); }
}
export function validationError(review: Review): ErrorCode | null {
  try { parseReview(review); return null; } catch (e) { return e instanceof ModelError ? e.code : "format"; }
}
export function blankReview(): Review {
  return { tool: TOOL, schemaVersion: 1, methodologyVersion: 1, kind: "review", projectName: "", purpose: "", assessor: "", conclusion: "", reviewDate: "",
    entries: checks.map(c => ({ id: c.id, state: "unknown", verification: "unreviewed", url: "", evidenceDate: "", note: "", exclusionReason: "" })) };
}
