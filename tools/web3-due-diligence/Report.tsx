import { categories, checks, type Locale } from "./catalog";
import { copy } from "./copy";
import { designCopy } from "./design-copy";
import { safeEvidenceUrl, summarize, type Review, type Snapshot } from "./model";
import styles from "./Tool.module.css";
export function Overview({ review, snapshot, locale, compact = false }: { review: Review; snapshot?: Snapshot; locale: Locale; compact?: boolean }) {
  const t = copy(locale), d = designCopy(locale), s = summarize(review);
  return <section aria-label={t.findings} className={compact ? styles.compactOverview : undefined}>
    <h2>{compact ? d.live : t.findings}</h2>
    {compact && <p className={styles.small}>{d.liveHelp}</p>}
    <div className={styles.metrics}>
      <div><strong data-testid="evidence-count">{s.overall.evidence}/{s.overall.applicable}</strong><span>{compact ? d.coverageShort : t.coverage}</span></div>
      <div><strong data-testid="concern-count">{s.concerns.length}</strong><span>{compact ? d.concernShort : t.concerns}</span></div>
      <div><strong data-testid="unresolved-count">{s.unresolved.length}</strong><span>{compact ? d.unresolvedShort : t.unresolved}</span></div>
      <div><strong>{s.excluded.length}/24</strong><span>{compact ? d.excludedShort : t.excluded}</span></div>
    </div>
    {!s.overall.applicable && <p className={styles.notice}>{t.noApplicable}</p>}
    <p className={styles.small}>{compact ? d.categoryEvidence : t.coverageHelp}</p>
    {snapshot && <p className={styles.notice}>{t.reported}: {snapshot.reported.overall.evidence}/{snapshot.reported.overall.applicable}. {t.included}: {s.overall.evidence}/{s.overall.applicable}.</p>}
    {s.critical.length > 0 && <div className={styles.critical}><strong>{t.critical}: {s.critical.length}</strong>{!compact && <p>{t.criticalNotice}</p>}<ul>{s.critical.map(r => <li key={r.check.id}>{r.check.title[locale]}</li>)}</ul></div>}
    <div className={styles.categoryGrid}>{compact && <p className={styles.eyebrow}>{d.categories}</p>}{categories.map(c => {
      const row = s.categories[c.id];
      return <div className={styles.categorySummary} key={c.id}><div className={styles.categoryLabel}><h3>{c.title[locale]}</h3>{compact && <strong>{row.evidence}/{row.applicable}</strong>}</div>
        {!compact && <p>{t.coverage}: <strong>{row.evidence}/{row.applicable}</strong> · {t.excluded}: {row.excluded}/4</p>}
        <div className={styles.bar} aria-hidden="true"><span style={{ width: `${row.evidence / 4 * 100}%` }} /></div>
        {!compact && <p className={styles.small}>{t.assessed}: {row.assessed}/{row.applicable} · {t.concerns}: {s.concerns.filter(r => r.check.category === c.id).length} · {t.unresolved}: {s.unresolved.filter(r => r.check.category === c.id).length}</p>}
        {snapshot && <p className={styles.small}>{t.reported}: {snapshot.reported.categories[c.id].evidence}/{row.applicable}</p>}
      </div>;
    })}</div>
  </section>;
}
export function Report({ review, snapshot, locale, id = "report" }: { review: Review; snapshot?: Snapshot; locale: Locale; id?: string }) {
  const t = copy(locale), s = summarize(review);
  return <article className={styles.report} id={id} aria-label={t.title}>
    <header className={styles.reportHeader}><p className={styles.eyebrow}>BLOCK CONSULT · WEB3</p><h2>{t.title}</h2><h3>{review.projectName || t.unnamed}</h3><p>{t.assessor}: {review.assessor || (snapshot && !snapshot.includes.notes ? t.omitted : t.unspecified)} · {t.date}: {review.reviewDate || t.unspecified}</p>{review.purpose && <p>{review.purpose}</p>}<p className={styles.small}>{t.scope}</p><p className={styles.small}>{t.version}</p></header>
    <Overview review={review} snapshot={snapshot} locale={locale} />
    <section><h2>{t.riskRegister}</h2>{!s.concerns.length && <p>{t.noConcerns}</p>}
      {s.concerns.map(({ check, entry }) => <div className={styles.registerRow} key={check.id}><h3><span className={styles.badge}>{t[check.priority]}</span> {check.title[locale]}</h3><p>{check.why[locale]}</p>{entry.note && <p>{entry.note}</p>}<p><strong>{t.question}:</strong> {check.question[locale]}</p></div>)}
    </section>
    <section><h2>{t.questions}</h2><p className={styles.small}>{t.questionsHelp}</p>{!s.questions.length && <p>{t.noQuestions}</p>}
      <ol className={styles.questions}>{s.questions.map(({ check, entry }) => <li key={check.id}><label><input type="checkbox" aria-label={check.question[locale]} /> <span><strong>{t[check.priority]} · {t[entry.state]}</strong><br />{check.question[locale]}</span></label></li>)}</ol>
    </section>
    <section><h2>{t.matrix}</h2><p className={styles.small}>{t.notVerified}</p>
      <div className={styles.inventory}>{checks.map(check => {
        const entry = review.entries.find(e => e.id === check.id)!;
        const href = safeEvidenceUrl(entry.url);
        return <div className={styles.inventoryRow} key={check.id}><h3>{check.title[locale]}</h3><p><strong>{t[entry.state]}</strong> · {t[entry.verification]}</p>
          {href ? <p><a href={href} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer">{entry.url}</a></p> : <p>{t.noEvidence}</p>}
          <p>{t.evidenceDate}: {entry.evidenceDate || (snapshot && !snapshot.includes.evidence ? t.omitted : t.unspecified)}</p>
          {entry.note && <p>{entry.note}</p>}
          {entry.state === "na" && <p>{t.reason}: {entry.exclusionReason || t.omitted}</p>}
        </div>;
      })}</div>
    </section>
    <section><h2>{t.exclusions}</h2>{!s.excluded.length && <p>{t.noExclusions}</p>}<ul>{s.excluded.map(r => <li key={r.check.id}><strong>{r.check.title[locale]}:</strong> {r.entry.exclusionReason || t.omitted}</li>)}</ul></section>
    {review.conclusion && <section><h2>{t.conclusionLabel}</h2><p className={styles.authored}>{review.conclusion}</p></section>}
    <section><h2>{t.methodology}</h2><p>{t.rubric}</p><p>{t.priorities}</p><p>{t.limitations}</p></section>
  </article>;
}
