import { categories, type Locale } from "./catalog";
import { copy } from "./copy";
import { summarize, type Review, type Snapshot } from "./model";
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportJson(value: unknown, name: string) { download(new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" }), name); }
/** One source of summary text for PNG and export verification. No hidden original model. */
export function summaryLines(review: Review, locale: Locale, snapshot?: Snapshot): string[] {
  const t = copy(locale), s = summarize(review);
  return ["BLOCK CONSULT", t.title, review.projectName || t.unnamed,
    `${t.assessor}: ${review.assessor || t.unspecified} · ${t.date}: ${review.reviewDate || t.unspecified}`,
    t.scope, t.version,
    `${t.coverage}: ${s.overall.evidence}/${s.overall.applicable} · ${t.excluded}: ${s.excluded.length}/24`,
    ...(s.overall.applicable ? [] : [t.noApplicable]),
    ...(snapshot ? [`${t.reported}: ${snapshot.reported.overall.evidence}/${snapshot.reported.overall.applicable} · ${t.included}: ${s.overall.evidence}/${s.overall.applicable}`] : []),
    `${t.concerns}: ${s.concerns.length} · ${t.critical}: ${s.critical.length} · ${t.unresolved}: ${s.unresolved.length}`,
    ...categories.map(c => `${c.title[locale]}: ${s.categories[c.id].evidence}/${s.categories[c.id].applicable} · ${t.excluded}: ${s.categories[c.id].excluded}/4`),
    t.riskRegister,
    ...(s.concerns.length ? s.concerns.map(r => `${t[r.check.priority]} · ${r.check.title[locale]}`) : [t.noConcerns]),
    t.questions, ...s.questions.slice(0, 3).map(r => r.check.question[locale]),
    t.coverageHelp, t.notVerified, t.rubric,
    ...(review.conclusion ? [`${t.conclusionLabel}: ${review.conclusion}`] : []),
  ];
}
export async function summaryPng(review: Review, locale: Locale, snapshot?: Snapshot): Promise<Blob> {
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const t = copy(locale);
  const rows: { text: string; y: number; size: number; weight: number; color: string; rule: boolean }[] = [];
  let y = 72;
  summaryLines(review, locale, snapshot).forEach((line, index) => {
    const section = line === t.riskRegister || line === t.questions;
    const metric = line.startsWith(t.coverage + ":") || line.startsWith(t.concerns + ":");
    const size = index === 1 ? 38 : index === 2 ? 28 : metric ? 27 : section ? 26 : 22;
    const weight = index < 2 || section || metric ? 600 : 400;
    const color = index === 0 || section ? "#2867c4" : index === 4 || index === 5 ? "#525866" : "#0b0d10";
    const lineHeight = Math.ceil(size * 1.4);
    if (section || metric) y += 16;
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    let row = "", first = true;
    const push = () => { rows.push({ text: row, y, size, weight, color, rule: section && first }); y += lineHeight; row = ""; first = false; };
    // Wrap using the actual font size, including unbroken authored strings.
    for (const word of line.replace(/\s+/g, " ").split(" ")) {
      const candidate = row ? `${row} ${word}` : word;
      if (ctx.measureText(candidate).width <= 1080) { row = candidate; continue; }
      if (row) push();
      for (const char of word) {
        if (ctx.measureText(row + char).width > 1080) push();
        row += char;
      }
    }
    push(); y += index < 3 || section ? 18 : 12;
  });
  canvas.width = 1200; canvas.height = Math.ceil(y + 42);
  ctx.fillStyle = "#f7f8fa"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#3176d2"; ctx.fillRect(60, 30, 56, 6);
  ctx.textBaseline = "top";
  rows.forEach(row => {
    if (row.rule) { ctx.fillStyle = "#c7cbd1"; ctx.fillRect(60, row.y - 18, 1080, 1); }
    ctx.fillStyle = row.color; ctx.font = `${row.weight} ${row.size}px Arial, sans-serif`;
    ctx.fillText(row.text, 60, row.y);
  });
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("png")), "image/png"));
}
