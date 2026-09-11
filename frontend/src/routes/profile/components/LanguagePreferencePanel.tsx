import { useContext } from 'react';
import { Check, CheckCircle2, Languages, Sparkles } from 'lucide-react';

import { Card, CardHeader } from '@/components/ui/card';
import { useLanguage, type Language } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import { SessionContext } from '@/context/SessionContext';

export function LanguagePreferencePanel() {
  const { language, setLanguage, currentMeta, languages, t } = useLanguage();
  const { success } = useToast();
  const session = useContext(SessionContext);
  const user = session?.user ?? null;

  const handleSelectLanguage = (code: Language) => {
    if (code === language) return;
    setLanguage(code);
    const selected = languages.find((l) => l.code === code);
    if (selected) {
      success(
        `${t('language.switchedToast')} ${selected.name} (${selected.englishName})`,
        t('language.instantApply')
      );
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--fd-accent-subtle-bg)] text-[var(--fd-accent)]">
          <Languages className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <CardHeader
            title={t('language.title')}
            description={t('language.description')}
          />
        </div>
      </div>

      {/* Language Selection Grid */}
      <div
        role="radiogroup"
        aria-label={t('language.title')}
        className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5"
      >
        {languages.map((lang) => {
          const isSelected = language === lang.code;

          return (
            <button
              type="button"
              key={lang.code}
              role="radio"
              aria-checked={isSelected}
              id={`lang-opt-${lang.code}`}
              onClick={() => handleSelectLanguage(lang.code)}
              className={`group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[var(--fd-focus-ring)] ${
                isSelected
                  ? 'border-[var(--fd-accent)] bg-[var(--fd-accent-subtle-bg)]/30 shadow-xs'
                  : 'border-[var(--fd-border)] bg-[var(--fd-surface-1)] hover:border-[var(--fd-border-strong)] hover:bg-[var(--fd-surface-2)]/60'
              }`}
            >
              {/* Top Row: Native Name & Radio Indicator */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold tracking-tight text-[var(--fd-text-primary)]">
                      {lang.name}
                    </span>
                    <span className="text-xs font-semibold text-[var(--fd-text-secondary)]">
                      ({lang.englishName})
                    </span>
                  </div>
                  <span className="mt-0.5 inline-block text-[11px] font-medium text-[var(--fd-accent)]">
                    {lang.script}
                  </span>
                </div>

                {/* Radio Circle / Checkmark */}
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isSelected
                      ? 'border-[var(--fd-accent)] bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)]'
                      : 'border-[var(--fd-border)] bg-[var(--fd-bg)] text-transparent group-hover:border-[var(--fd-text-tertiary)]'
                  }`}
                  aria-hidden="true"
                >
                  {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
              </div>

              {/* Bottom: Context / Region note */}
              <div className="mt-3 pt-2.5 border-t border-[var(--fd-border-subtle)]/70 flex items-center justify-between text-[11px] text-[var(--fd-text-tertiary)]">
                <span>{lang.region}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--fd-text-tertiary)]">
                  {lang.code.toUpperCase()}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Preview Indicator */}
      <div className="mt-5 rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)]/60 p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--fd-text-primary)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--fd-accent)] shrink-0" aria-hidden="true" />
            <span>{t('language.previewTitle')}:</span>
          </div>
          <span className="rounded bg-[var(--fd-accent-subtle-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--fd-accent)] uppercase tracking-wider">
            {currentMeta.englishName} ({currentMeta.name})
          </span>
        </div>

        <div className="mt-2 text-xs sm:text-sm text-[var(--fd-text-secondary)] flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-[var(--fd-text-primary)]">
            {currentMeta.sampleGreeting}, {user?.name ?? 'Client'}
          </span>
          <span className="text-[var(--fd-text-tertiary)]">•</span>
          <span className="inline-flex items-center gap-1 text-[var(--fd-status-done)] font-medium text-xs">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            <span>{currentMeta.sampleNotice}</span>
          </span>
        </div>

        <p className="mt-2 text-[11px] text-[var(--fd-text-tertiary)] leading-normal">
          {t('language.instantApply')}
        </p>
      </div>
    </Card>
  );
}
