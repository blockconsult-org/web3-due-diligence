"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import { SelectField } from "@/simulator/components/fields/select-field";
import { localeHref } from "@/content/i18n";
import { checks, type Category, type Locale } from "./catalog";
import { copy } from "./copy";
import { blankReview, parseDocument, parseFile, parseReview, safeEvidenceUrl, STORAGE_KEY, MAX_FILE_BYTES, validationError, validDate, summarize, type Document, type Entry, type Review, type ShareOptions, type Snapshot } from "./model";
import { decodeSnapshot, encodeSnapshot, makeSnapshot } from "./codec";
import { preset } from "./presets";
import { download, exportJson, summaryPng } from "./export";
import { Overview, Report } from "./Report";
import { ReviewEditor } from "./ReviewEditor";
import { designCopy } from "./design-copy";
import styles from "./Tool.module.css";
const TRANSFER_KEY = `${STORAGE_KEY}:locale-transfer`;
type View = { draft: Review; snapshot: Snapshot | null; previous: Document | null; message: string };
type Action = { type: "draft"; review: Review } | { type: "replace"; doc: Document; message?: string } | { type: "message"; message: string } | { type: "back" } | { type: "copy"; message: string } | { type: "undo" };
function reducer(state: View, action: Action): View {
  switch (action.type) {
    case "message": return { ...state, message: action.message };
    case "draft": return { ...state, draft: action.review, message: "" };
    case "replace": return { ...state, previous: state.snapshot || state.draft, ...(action.doc.kind === "snapshot" ? { snapshot: action.doc } : { draft: action.doc, snapshot: null }), message: action.message || "" };
    case "back": return { ...state, snapshot: null, message: "" };
    case "copy": return state.snapshot ? { draft: structuredClone(state.snapshot.review), snapshot: null, previous: state.draft, message: action.message } : state;
    case "undo": return state.previous ? { ...state, ...(state.previous.kind === "snapshot" ? { snapshot: state.previous } : { draft: state.previous, snapshot: null }), previous: null, message: "" } : state;
  }
}
function clearHash() { window.history.replaceState(null, "", window.location.pathname + window.location.search); }
export function DueDiligence({ locale }: { locale: Locale }) {
  const t = copy(locale), d = designCopy(locale);
  const [view, dispatch] = useReducer(reducer, undefined, () => ({ draft: blankReview(), snapshot: null, previous: null, message: "" }));
  const [shareOptions, setShareOptions] = useState<ShareOptions>({ projectName: false, notes: false, evidence: false });
  const [sharing, setSharing] = useState(false), [link, setLink] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [presetChoice, setPresetChoice] = useState("blank");
  const [category, setCategory] = useState<Category>("team");
  const [active, setActive] = useState(checks[0].id);
  const dialog = useRef<HTMLDialogElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const shareButton = useRef<HTMLButtonElement>(null);
  const linkField = useRef<HTMLTextAreaElement>(null);
  const pointerFocus = useRef(false);
  const [exporting, setExporting] = useState(false);
  const review = view.snapshot?.review || view.draft;
  const result = summarize(review);
  const reportVisible = showReport || !!view.snapshot;
  const error = view.snapshot ? null : validationError(review);
  const publicSnapshot = !view.snapshot && !error ? makeSnapshot(review, shareOptions) : view.snapshot;
  useEffect(() => {
    const onHash = () => {
      // The shared site's skip link is a document anchor, not a scenario.
      if (["#main", "#report", "#full-report", "#public-preview"].includes(window.location.hash)) return;
      setLink("");
      setSharing(false);
      if (!window.location.hash) { dispatch({ type: "back" }); return; }
      const snapshot = decodeSnapshot(window.location.hash);
      if (snapshot) dispatch({ type: "replace", doc: snapshot });
      else dispatch({ type: "message", message: t.invalid });
    };
    // The effect only subscribes to browser state; the reducer receives validated events.
    const init = window.setTimeout(() => {
      if (window.location.hash) { onHash(); return; }
      try {
        const value = sessionStorage.getItem(TRANSFER_KEY);
        if (value) {
          const transfer = JSON.parse(value);
          if (transfer.locale === locale) {
            const doc = parseDocument(transfer.doc);
            sessionStorage.removeItem(TRANSFER_KEY);
            setPresetChoice("custom");
            if (transfer.draft) dispatch({ type: "replace", doc: parseReview(transfer.draft) });
            dispatch({ type: "replace", doc });
          }
        }
      } catch { dispatch({ type: "message", message: t.localeError }); }
    }, 0);
    window.addEventListener("hashchange", onHash);
    return () => { clearTimeout(init); window.removeEventListener("hashchange", onHash); };
  }, [locale, t.invalid, t.localeError]);
  useEffect(() => {
    const node=dialog.current;
    if (!node) return;
    if (sharing && !node.open) node.showModal();
    if (!sharing && node.open) node.close();
  }, [sharing]);
  useEffect(()=>{
    if (!link || !sharing) return;
    const field=linkField.current;
    field?.focus();
    // Native focus can reveal only the selected text inside a scrolling dialog.
    field?.scrollIntoView({block:"nearest",behavior:"instant"});
  },[link,sharing]);
  function changeArea(id: Category) { setCategory(id); setActive(checks.find(c=>c.category===id)!.id); }
  function chooseCheck(id: string, focus=false) {
    setActive(id);
    if (focus) requestAnimationFrame(()=> { const node=document.getElementById(`dd-check-${id}`); node?.focus(); node?.scrollIntoView({block:"start",behavior:"instant"}); });
  }
  function changeView(report: boolean) {
    setShowReport(report);
    requestAnimationFrame(()=>{ workspace.current?.querySelector<HTMLButtonElement>('nav button[aria-pressed="true"]')?.focus({preventScroll:true}); workspace.current?.scrollIntoView({block:"start",behavior:"instant"}); });
  }
  function focusError() {
    const e=review.entries.find(e=>(e.url&&!safeEvidenceUrl(e.url))||(e.evidenceDate&&(!validDate(e.evidenceDate)||(review.reviewDate&&e.evidenceDate>review.reviewDate)))||(e.state==="na"&&!e.exclusionReason?.trim())||(e.verification==="reviewed"&&(!e.url||!e.evidenceDate)));
    setShowReport(false);
    if(e) { changeArea(checks.find(c=>c.id===e.id)!.category);setActive(e.id); }
    requestAnimationFrame(()=>workspace.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }
  function keepFocusVisible(target: EventTarget) {
    if (!(target instanceof HTMLElement) || target===document.body || target.closest("dialog")) return;
    requestAnimationFrame(()=>{
      if(target!==document.activeElement || !target.isConnected) return;
      const box=target.getBoundingClientRect();
      const notice=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cookie-notice-height"))||0;
      const bottom=innerHeight-Math.max(88,notice+72);
      const nav=workspace.current?.querySelector("nav")?.getBoundingClientRect();
      const top=nav && nav.top>=0 && nav.top<120 ? nav.bottom+12 : 88;
      if (box.bottom>bottom) window.scrollBy({top:box.bottom-bottom,behavior:"instant"});
      else if(box.top<top && !target.closest("nav")) window.scrollBy({top:box.top-top,behavior:"instant"});
    });
  }
  function message(value: string) { dispatch({ type: "message", message: value }); }
  function replace(doc: Document, msg?: string) { setShowReport(false); setPresetChoice("custom"); changeArea("team"); clearHash(); setLink(""); setSharing(false); dispatch({ type: "replace", doc, message: msg }); }
  function edit(patch: Partial<Review>) { setPresetChoice("custom"); setLink(""); dispatch({ type: "draft", review: { ...view.draft, ...patch } }); }
  function entryEdit(id: string, patch: Partial<Entry>) { edit({ entries: review.entries.map(e => e.id === id ? { ...e, ...patch } : e) }); }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(parseReview(review))); message(t.saved); } catch { message(t.storageError); } }
  function load() { try { const value = localStorage.getItem(STORAGE_KEY); if (!value) return message(t.noSaved); const doc = parseFile(value); if (doc.kind !== "review") throw new Error(); replace(doc, t.loaded); } catch { message(t.storageError); } }
  function deleteSaved() { try { localStorage.removeItem(STORAGE_KEY); message(t.deleted); } catch { message(t.storageError); } }
  async function importFile(file?: File) {
    if (!file) return;
    try { if (file.size > MAX_FILE_BYTES) throw new Error(); replace(parseFile(await file.text()), t.imported); } catch { message(t.invalid); }
  }
  async function png(publicOnly = false) {
    if (exporting) return;
    setExporting(true);
    try {
      const snapshot = publicOnly ? publicSnapshot : view.snapshot;
      const model = snapshot?.review || review;
      download(await summaryPng(model, locale, snapshot || undefined), `blockconsult-due-diligence-${publicOnly ? "public-" : ""}${locale}.png`);
      message(d.exported);
    } catch { message(t.exportError); } finally { setExporting(false); }
  }
  function switchLocale() {
    if (error || validationError(view.draft)) return message(t.requiredFix);
    const next = locale === "en" ? "de" : "en";
    try {
      sessionStorage.setItem(TRANSFER_KEY, JSON.stringify({ locale: next, doc: view.snapshot || review, draft: view.snapshot ? view.draft : undefined }));
      window.location.assign(localeHref(next, "/tools/web3-due-diligence"));
    } catch { message(t.localeError); }
  }
  function createLink() {
    if (!publicSnapshot) return;
    try { setLink("https://www.blockconsult.org" + window.location.pathname + encodeSnapshot(publicSnapshot)); message(""); }
    catch { message(t.large); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); message(t.copied); } catch { message(t.copyFallback); if(dialog.current?.open) linkField.current?.focus(); }
  }
  return <div className={styles.root} onPointerDownCapture={()=>{pointerFocus.current=true;}} onPointerUpCapture={()=>{pointerFocus.current=false;requestAnimationFrame(()=>{if(document.activeElement instanceof HTMLElement) keepFocusVisible(document.activeElement);});}} onPointerCancelCapture={()=>{pointerFocus.current=false;}} onKeyDownCapture={()=>{pointerFocus.current=false;}} onFocusCapture={event=>{if(!pointerFocus.current) keepFocusVisible(event.target);}}>
    <div className={styles.screenOnly}>
      <div className={styles.toolbar}>
        {!view.snapshot ? <div className={styles.presetControl}><SelectField id="dd-preset" label={t.presets} value={presetChoice} options={[{value:"blank",label:t.blank},{value:"harbor",label:t.harbor},{value:"orbit",label:t.orbit},...(presetChoice==="custom"?[{value:"custom",label:d.custom}]:[])]} onChange={id=>{if(id!=="custom"){replace(preset(id as "blank"|"harbor"|"orbit",locale));setPresetChoice(id);}}}/></div> : <p className={styles.snapshotLabel}>{t.snapshot}</p>}
        <div className={styles.mainActions}>
          {!view.snapshot && <button className={styles.primary} onClick={save} disabled={!!error}>{t.save}</button>}
          <button ref={shareButton} aria-label={t.share} disabled={!!error} aria-haspopup="dialog" onClick={()=>{message("");setSharing(true);}}>{d.share} <span aria-hidden="true">↗</span></button>
          <button aria-expanded={moreOpen} aria-controls="dd-files" onClick={()=>setMoreOpen(!moreOpen)}>{d.more} <span aria-hidden="true">{moreOpen?"−":"+"}</span></button>
        </div>
      </div>
      <div className={styles.toolbarFoot}><p>{d.browser}</p><button className={styles.textButton} onClick={switchLocale}>{t.language}</button></div>
      {moreOpen && <section id="dd-files" className={styles.filePanel} aria-label={d.more}>
        {!view.snapshot && <div><h2>{d.savedGroup}</h2><div className={styles.actions}><button onClick={load}>{t.load}</button><button className={styles.destructive} onClick={deleteSaved}>{t.delete}</button></div><p>{t.storage}</p><p>{d.deleteHelp}</p></div>}
        <div><h2>{d.filesGroup}</h2><div className={styles.actions}><button disabled={!!error} onClick={()=>exportJson(view.snapshot||parseReview(review),`web3-due-diligence-${locale}.json`)}>{view.snapshot?t.publicJson:t.export}</button><label className={styles.file}>{t.import}<input aria-label={t.import} type="file" accept=".json,application/json" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value="";}}/></label><button disabled={!!error} onClick={()=>window.print()}>{t.print}</button><button aria-label={t.png} aria-busy={exporting} disabled={!!error||exporting} onClick={()=>void png()}>{exporting?d.exporting:t.png}</button></div><p>{t.importHelp}</p></div>
        {!view.snapshot && <div><h2>{d.resetGroup}</h2><div className={styles.actions}><button className={styles.destructive} onClick={()=>{replace(blankReview());setPresetChoice("blank");}}>{t.reset}</button><button disabled={!view.previous} onClick={()=>{clearHash();dispatch({type:"undo"});setLink("");setPresetChoice("custom");}}>{t.undo}</button></div><p>{t.fictional}</p></div>}
      </section>}
      <div className={styles.live} role="status" aria-live="polite">{!sharing&&view.message}</div>
      {view.snapshot&&<div className={styles.snapshotNotice}><h2>{t.snapshot}</h2><p>{t.snapshotHelp}</p><div className={styles.actions}><button className={styles.primary} onClick={()=>{clearHash();setShowReport(false);setPresetChoice("custom");dispatch({type:"copy",message:t.copiedReview});setLink("");}}>{t.makeCopy}</button><button onClick={()=>{clearHash();setShowReport(false);dispatch({type:"back"});}}>{t.back}</button></div></div>}
    </div>
    <div ref={workspace} className={styles.workspace}>
      <nav className={`${styles.viewNav} ${styles.screenOnly}`} aria-label={d.views}>
        <div className={styles.viewButtons}>{!view.snapshot&&<button aria-pressed={!reportVisible} aria-controls="dd-assessment" onClick={()=>changeView(false)}>{d.assess}</button>}<button aria-pressed={reportVisible} aria-controls="full-report" onClick={()=>changeView(true)}>{d.report}<span className={styles.count}>{result.unresolved.length}</span></button></div><span className={styles.total}>{d.all}</span>
      </nav>
      {error&&<div role="alert" className={`${styles.validation} ${styles.screenOnly}`}><div><strong>{t.errors[error]}</strong><p>{t.requiredFix}</p></div><button onClick={focusError}>{d.jump} →</button></div>}
      {!view.snapshot&&<div id="dd-assessment" role="region" aria-label={t.editor} className={`${styles.assessmentGrid} ${styles.screenOnly} ${reportVisible?styles.hidden:""}`}>
        <ReviewEditor review={review} locale={locale} category={category} active={active} onCategory={changeArea} onActive={chooseCheck} edit={edit} entryEdit={entryEdit} onReport={()=>changeView(true)} findings={<aside className={styles.liveFindings} aria-label={d.live}><Overview review={review} locale={locale} compact/><button className={styles.reportLink} onClick={()=>changeView(true)}>{d.fullReport} <span aria-hidden="true">→</span></button></aside>}/>
      </div>}
      <div id="full-report" className={!reportVisible?styles.collapsedReport:styles.reportView}><Report key={JSON.stringify(review)} review={review} snapshot={view.snapshot||undefined} locale={locale}/></div>
    </div>
    <dialog ref={dialog} className={`${styles.shareDialog} ${styles.screenOnly}`} aria-labelledby="dd-share-title" onKeyDown={event=>{
      if(event.key!=="Tab") return;
      const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea,summary,a[href]')].filter(el=>el.getClientRects().length>0);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first) {event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last) {event.preventDefault();first?.focus();}
    }} onClose={()=>{setSharing(false);shareButton.current?.focus();}} onCancel={()=>setSharing(false)}>
      <div className={styles.dialogHeader}><div><p className={styles.eyebrow}>{t.preview}</p><h2 id="dd-share-title">{d.previewIntro}</h2></div><button autoFocus aria-label={d.close} onClick={()=>setSharing(false)}>×</button></div>
      <div className={styles.dialogBody}>
        <p className={styles.small}>{t.shareHelp}</p>
        {!view.snapshot&&<div className={styles.shareChoices}>{(["projectName","notes","evidence"] as const).map((key,i)=><label key={key}><input type="checkbox" checked={shareOptions[key]} aria-label={[t.includeProject,t.includeNotes,t.includeEvidence][i]} onChange={e=>{setShareOptions({...shareOptions,[key]:e.target.checked});setLink("");}}/><span><strong>{[d.name,d.notes,d.evidence][i]}</strong><span>{[t.includeProject,t.includeNotes,t.includeEvidence][i]}</span></span></label>)}</div>}
        <p className={styles.small}>{t.previewNote}</p>
        {link&&<label className={styles.field}><span>{t.link}</span><textarea ref={linkField} aria-label={t.link} readOnly value={link} onFocus={e=>e.currentTarget.select()}/></label>}
        {publicSnapshot&&<details className={styles.publicPreview}><summary>{t.publicSummary}</summary><Report review={publicSnapshot.review} snapshot={publicSnapshot} locale={locale} id="public-preview"/></details>}
      </div>
      <div className={styles.dialogFooter}><div className={styles.dialogNotice} role="status">{sharing&&view.message}</div><div className={styles.actions}><button className={styles.primary} onClick={createLink} disabled={!publicSnapshot}>{t.createLink}</button>{link&&<button onClick={()=>void copyLink()}>{t.copyLink}</button>}</div><div className={styles.actions}><button disabled={!publicSnapshot} onClick={()=>exportJson(publicSnapshot,`web3-due-diligence-public-${locale}.json`)}>{t.publicJson}</button><button aria-label={t.publicPng} aria-busy={exporting} disabled={!publicSnapshot||exporting} onClick={()=>void png(true)}>{exporting?d.exporting:t.publicPng}</button></div></div>
    </dialog>
  </div>;
}
