"use client";
import type { ReactNode } from "react";
import { SelectField } from "@/simulator/components/fields/select-field";
import { categories, checks, type Category, type Locale } from "./catalog";
import { copy } from "./copy";
import { designCopy } from "./design-copy";
import { safeEvidenceUrl, states, summarize, validDate, verifications, type Entry, type Review } from "./model";
import s from "./Tool.module.css";
export function ReviewEditor({ review, locale, category, active, onCategory, onActive, edit, entryEdit, onReport, findings }: {
  review: Review; locale: Locale; category: Category; active: string;
  onCategory: (id: Category) => void; onActive: (id: string, focus?: boolean) => void;
  edit: (patch: Partial<Review>) => void; entryEdit: (id: string, patch: Partial<Entry>) => void; onReport: () => void; findings: ReactNode;
}) {
  const t=copy(locale), d=designCopy(locale), summary=summarize(review);
  const group=checks.filter(c=>c.category===category);
  function next(id: string) {
    const index=checks.findIndex(c=>c.id===id), target=checks[index+1];
    if (!target) return onReport();
    if (target.category!==category) onCategory(target.category);
    onActive(target.id, true);
  }
  return <>
    <div className={s.context}>
      <div className={s.sectionHeading}><span className={s.step}>01</span><div><h2>{d.context}</h2><p className={s.small}>{d.contextHelp}</p></div></div>
      <div className={s.fields}>
        <label className={`${s.field} ${s.fullWidth}`}><span>{t.project}</span><input value={review.projectName||""} maxLength={120} onChange={e=>edit({projectName:e.target.value})}/></label>
        <label className={s.field}><span>{t.assessor}</span><input value={review.assessor||""} maxLength={120} onChange={e=>edit({assessor:e.target.value})}/></label>
        <label className={s.field}><span>{t.date}</span><input type="date" min="2000-01-01" max="2100-12-31" value={review.reviewDate} aria-invalid={!!review.reviewDate&&!validDate(review.reviewDate)} onChange={e=>edit({reviewDate:e.target.value})}/></label>
      </div>
      <details className={s.optional}><summary>{review.purpose ? t.purpose : d.purpose}</summary><label className={s.field}><span>{t.purpose}</span><textarea aria-label={t.purpose} value={review.purpose||""} maxLength={500} onChange={e=>edit({purpose:e.target.value})}/></label></details>
    </div>
    {findings}
    <div className={s.reviewSection}>
      <div className={s.sectionHeading}><span className={s.step}>02</span><div><h2>{t.editor}</h2><p className={s.small}>{d.categoryHelp}</p></div></div>
      <div className={s.areaSelect}><SelectField id="dd-area" label={d.area} value={category} options={categories.map((c,i)=>({value:c.id,label:`0${i+1} / ${c.title[locale]}`}))} onChange={onCategory}/><span className={s.areaProgress}><span>{summary.categories[category].assessed}/{summary.categories[category].applicable} {d.progress}</span><span>{summary.categories[category].excluded} {d.excludedShort.toLowerCase()}</span></span></div>
      <div className={s.checkList}>{group.map(check=>{
        const e=review.entries.find(e=>e.id===check.id)!;
        const number=checks.indexOf(check)+1;
        const urlError=e.url&&!safeEvidenceUrl(e.url)?t.errors.url:undefined;
        const dateError=e.evidenceDate&&(!validDate(e.evidenceDate)||(review.reviewDate&&e.evidenceDate>review.reviewDate))?t.errors.date:undefined;
        const verificationError=e.verification==="reviewed"&&(!e.url||!e.evidenceDate)?t.errors.verification:undefined;
        return <details className={s.check} key={e.id} data-testid={e.id} open={active===e.id}>
          <summary id={`dd-check-${e.id}`} onClick={event=>{event.preventDefault();onActive(active===e.id?"":e.id);}}><span className={s.checkNumber}>{String(number).padStart(2,"0")}</span><span className={s.checkTitle}>{check.title[locale]}<span className={s.checkMeta}>{t.priority}: {t[check.priority]}</span></span><span className={s.state} data-state={e.state}>{t[e.state]}</span><span className={s.chevron} aria-hidden="true">⌄</span></summary>
          <div className={s.checkBody}>
            <p className={s.rationale}>{check.why[locale]}</p>
            <div className={s.evidenceHint}><strong>{t.evidenceHelp}</strong><p>{check.evidence[locale]}</p></div>
            <fieldset><legend className={s.srOnly}>{check.title[locale]}</legend>
              <SelectField id={`dd-${e.id}-state`} label={t.state} value={e.state} options={states.map(value=>({value,label:t[value]}))} onChange={state=>entryEdit(e.id,{state})}/>
              <p className={s.fieldHint}>{d.assessmentHint}</p>
              {e.state==="na"&&<label className={s.field}><span>{t.reason}</span><textarea aria-label={t.reason} aria-describedby={!e.exclusionReason?.trim()?`reason-error-${e.id}`:undefined} required value={e.exclusionReason||""} maxLength={500} aria-invalid={!e.exclusionReason?.trim()} onChange={ev=>entryEdit(e.id,{exclusionReason:ev.target.value})}/>{!e.exclusionReason?.trim()&&<span className={s.errorText} id={`reason-error-${e.id}`}>{t.errors.reason}</span>}</label>}
              <div className={s.evidenceFields}><h3>{d.source}</h3>
                <label className={s.field}><span>{t.evidenceUrl}</span><input aria-label={t.evidenceUrl} type="url" value={e.url||""} maxLength={2048} placeholder="https://" aria-invalid={!!urlError} aria-describedby={urlError?`url-error-${e.id}`:undefined} onChange={ev=>entryEdit(e.id,{url:ev.target.value})}/>{urlError&&<span className={s.errorText} id={`url-error-${e.id}`}>{urlError}</span>}</label>
                <div className={s.fields}><label className={s.field}><span>{t.evidenceDate}</span><input aria-label={t.evidenceDate} type="date" min="2000-01-01" max={review.reviewDate||"2100-12-31"} value={e.evidenceDate||""} aria-invalid={!!dateError} aria-describedby={dateError?`date-error-${e.id}`:undefined} onChange={ev=>entryEdit(e.id,{evidenceDate:ev.target.value})}/>{dateError&&<span className={s.errorText} id={`date-error-${e.id}`}>{dateError}</span>}</label>
                <SelectField id={`dd-${e.id}-verification`} label={t.verification} value={e.verification} options={verifications.map(value=>({value,label:t[value]}))} error={verificationError} onChange={verification=>entryEdit(e.id,{verification})}/></div>
              </div>
              <details className={s.optional}><summary>{e.note ? t.note : d.optionalNote}</summary><label className={s.field}><span>{t.note}</span><textarea aria-label={t.note} value={e.note||""} maxLength={2000} onChange={ev=>entryEdit(e.id,{note:ev.target.value})}/></label></details>
            </fieldset>
            <div className={s.checkFooter}><span>{d.check} {number} {d.of} 24</span><button onClick={()=>next(e.id)}>{number===24?d.finish:d.next} <span aria-hidden="true">→</span></button></div>
          </div>
        </details>;
      })}</div>
    </div>
    <details className={s.conclusion}><summary>{t.conclusion}</summary><label className={s.field}><span className={s.srOnly}>{t.conclusion}</span><textarea aria-label={t.conclusion} value={review.conclusion||""} maxLength={2000} onChange={e=>edit({conclusion:e.target.value})}/></label></details>
    <button className={s.primary} onClick={onReport}>{d.finish} <span aria-hidden="true">→</span></button>
  </>;
}
