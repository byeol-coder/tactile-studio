import { useAppStore } from '../../app/appState';
import { A11Y, type Language } from '../../i18n/messages';
import styles from './LanguageToggle.module.css';

const OPTIONS: { lang: Language; label: string }[] = [
  { lang: 'ko', label: 'KO' },
  { lang: 'en', label: 'EN' },
];

/** Compact KO/EN language toggle. Drives i18n + a11y announcement language. */
export function LanguageToggle() {
  const { state, dispatch } = useAppStore();
  return (
    <div className={styles.group} role="group" aria-label={A11Y[state.language].languageLabel}>
      {OPTIONS.map((o) => {
        const active = state.language === o.lang;
        return (
          <button
            key={o.lang}
            type="button"
            className={`${styles.opt} ${active ? styles.active : ''}`}
            aria-pressed={active}
            onClick={() => dispatch({ type: 'language/set', language: o.lang })}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
