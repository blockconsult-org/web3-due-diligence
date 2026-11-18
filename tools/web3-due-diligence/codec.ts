import { parseDocument, parseReview, summarize, type Review, type ShareOptions, type Snapshot, TOOL } from "./model";
export const HASH_PREFIX = "#dd1=";
export const MAX_ENCODED_LENGTH = 48_000;
export const MAX_DECODED_BYTES = 36_000;
export function makeSnapshot(review: Review, includes: ShareOptions): Snapshot {
  const clean = parseReview(review);
  const report = summarize(clean);
  const redacted: Review = { tool: TOOL, schemaVersion: 1, methodologyVersion: 1, kind: "review", reviewDate: clean.reviewDate,
    ...(includes.projectName && clean.projectName !== undefined && { projectName: clean.projectName }),
    ...(includes.notes && { purpose: clean.purpose, assessor: clean.assessor, conclusion: clean.conclusion }),
    entries: clean.entries.map(e => ({ id: e.id, state: e.state, verification: includes.evidence ? e.verification : "unreviewed",
      ...(includes.evidence && { url: e.url, evidenceDate: e.evidenceDate }),
      ...(includes.notes && { note: e.note, exclusionReason: e.exclusionReason }) })) };
  return { tool: TOOL, schemaVersion: 1, methodologyVersion: 1, kind: "snapshot", review: redacted, includes: { ...includes }, reported: { overall: report.overall, categories: report.categories } };
}
export function encodeSnapshot(snapshot: Snapshot): string {
  const valid = parseDocument(snapshot);
  const bytes = new TextEncoder().encode(JSON.stringify(valid));
  if (bytes.length > MAX_DECODED_BYTES) throw new Error("large");
  const encoded = btoa(Array.from(bytes, b => String.fromCharCode(b)).join("")).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  if (encoded.length > MAX_ENCODED_LENGTH) throw new Error("large");
  return HASH_PREFIX + encoded;
}
export function decodeSnapshot(hash: string): Snapshot | null {
  try {
    if (!hash.startsWith(HASH_PREFIX)) return null;
    const encoded = hash.slice(HASH_PREFIX.length);
    if (!encoded || encoded.length > MAX_ENCODED_LENGTH || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
    const binary = atob(encoded.replaceAll("-", "+").replaceAll("_", "/"));
    if (binary.length > MAX_DECODED_BYTES) return null;
    const doc = parseDocument(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0)))));
    return doc.kind === "snapshot" ? doc : null;
  } catch { return null; }
}
