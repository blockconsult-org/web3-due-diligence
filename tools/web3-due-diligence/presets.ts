import type { Locale } from "./catalog";
import { blankReview, type Review } from "./model";
export function preset(id: "blank" | "harbor" | "orbit", locale: Locale): Review {
  const review = blankReview();
  if (id === "blank") return review;
  const de = locale === "de";
  review.projectName = id === "harbor" ? "Harbor Commons (" + (de ? "fiktiv" : "fictional") + ")" : "Orbit Orchard (" + (de ? "fiktiv" : "fictional") + ")";
  review.reviewDate = "2026-10-15";
  review.assessor = de ? "Fiktives Beispielteam" : "Fictional example team";
  review.purpose = de ? "Illustrative Partnerprüfung. Alle Belege und Projektangaben sind erfunden." : "Illustrative partner review. All evidence and project details are invented.";
  review.entries = review.entries.map((e, i) => {
    if (id === "harbor" && i % 4 !== 3) return { ...e, state: "supported", url: `https://example.invalid/harbor/${e.id}`, evidenceDate: "2026-10-01", verification: "reviewed", note: de ? "Fiktiver datierter Beleg; keine tatsächliche Prüfung." : "Fictional dated source; no actual verification." };
    if (id === "orbit" && [0, 8, 20].includes(i)) return { ...e, state: "supported", url: `https://example.invalid/orbit/${e.id}`, note: de ? "Nur eine unbelegte Ankündigung; Prüfung offen." : "An unsupported announcement only; review pending." };
    return e;
  });
  for (const idCheck of (id === "harbor" ? ["contracts-upgrade"] : ["contracts-keys", "audit-remediation", "token-supply", "governance-treasury"])) {
    const e = review.entries.find(e => e.id === idCheck)!;
    e.state = "concern";
    e.note = de ? "Fiktiver Befund: Kontrollrechte bzw. Abschlussbelege sind ungeklärt. Vor dem nächsten Schritt klären." : "Fictional finding: control rights or closure evidence remain unresolved. Clarify before proceeding.";
  }
  review.conclusion = de ? "Eigene Beispiel-Einschätzung: Die offenen Fragen erfordern zusätzliche Belege." : "Example author’s assessment: the open questions require further evidence.";
  return review;
}
