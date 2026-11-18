import { ToolHeader } from "@/components/tools/ToolHeader";
import { localeHref } from "@/content/i18n";
import { Container } from "@/components/Container";
import { DueDiligence } from "@/tools/web3-due-diligence/DueDiligence";
import { copy } from "@/tools/web3-due-diligence/copy";
import { manifest } from "@/tools/web3-due-diligence/manifest";
import styles from "@/tools/web3-due-diligence/Tool.module.css";
export default function Page({ locale }: { locale: 'en' | 'de' }) {
  const t = copy(locale);
  return <div className={styles.page}>
    <ToolHeader tool="web3-due-diligence" locale={locale} title={t.title} titleId="page-title" lead={`${t.lead} ${t.intro}`} note={t.scope} />
    <Container><DueDiligence locale={locale} />
      <details className={`${styles.methodology} ${styles.screenOnly}`}><summary>{t.methodology}</summary><p>{t.rubric}</p><p>{t.priorities}</p><p>{t.limitations}</p></details>
      <p className={`${styles.service} ${styles.screenOnly}`}><a href={localeHref(locale, "/services/due-diligence")}>{t.service} ↗</a></p>
    </Container>
  </div>;
}
