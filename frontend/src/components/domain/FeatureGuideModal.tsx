import * as RadixDialog from '@radix-ui/react-dialog';
import {
  ArrowRight,
  BarChart,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Check,
  CheckSquare,
  FileText,
  Globe,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  Play,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { useFeatureGuide } from '@/context/FeatureGuideContext';
import { useLanguage } from '@/context/LanguageContext';
import { FEATURE_GUIDES } from '@/lib/featureGuides/featureGuideData';
import { cn } from '@/lib/cn';

const ICON_MAP: Record<string, ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="h-5 w-5" />,
  Building2: <Building2 className="h-5 w-5" />,
  CheckSquare: <CheckSquare className="h-5 w-5" />,
  ShieldCheck: <ShieldCheck className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  Inbox: <Inbox className="h-5 w-5" />,
  MessageSquare: <MessageSquare className="h-5 w-5" />,
  Briefcase: <Briefcase className="h-5 w-5" />,
  BarChart: <BarChart className="h-5 w-5" />,
  Bell: <Bell className="h-5 w-5" />,
  Settings: <Settings className="h-5 w-5" />,
  Globe: <Globe className="h-5 w-5" />,
};

const UI_TEXT = {
  en: {
    guideTitle: 'Feature Guide & Manual',
    inSimpleTerms: 'In Simple Terms',
    whyItMatters: 'Why This Matters',
    howItWorks: 'How It Works / Workflow',
    buttonsExplained: 'Buttons & Controls on this Screen',
    proTipsTitle: 'CA Practice Pro Tips',
    startTourBtn: 'Interactive Tutorial',
    takeTourBadge: 'Live Walkthrough',
    bannerTitle: 'Want a guided walkthrough of every button?',
    bannerDesc: 'Experience an interactive step-by-step tour that spotlights and explains each button directly on your screen.',
    close: 'Close',
    clickToSpotlight: 'Spotlight this button',
    allLanguages: 'Language',
  },
  hi: {
    guideTitle: 'à¤¸à¥à¤µà¤¿à¤§à¤¾ à¤—à¤¾à¤‡à¤¡ à¤µ à¤µà¤¿à¤µà¤°à¤£',
    inSimpleTerms: 'à¤¸à¤°à¤² à¤¶à¤¬à¥à¤¦à¥‹à¤‚ à¤®à¥‡à¤‚ à¤¸à¤®à¤à¥‡à¤‚',
    whyItMatters: 'à¤¯à¤¹ à¤•à¥à¤¯à¥‹à¤‚ à¤®à¤¹à¤¤à¥à¤µà¤ªà¥‚à¤°à¥à¤£ à¤¹à¥ˆ',
    howItWorks: 'à¤•à¤¾à¤°à¥à¤¯à¤ªà¥à¤°à¤£à¤¾à¤²à¥€ (Workflow)',
    buttonsExplained: 'à¤‡à¤¸ à¤¸à¥à¤•à¥à¤°à¥€à¤¨ à¤•à¥‡ à¤®à¥à¤–à¥à¤¯ à¤¬à¤Ÿà¤¨à¥à¤¸ à¤”à¤° à¤‰à¤¨à¤•à¥‡ à¤•à¤¾à¤°à¥à¤¯',
    proTipsTitle: 'à¤¸à¥€à¤ à¤«à¤°à¥à¤® à¤‰à¤ªà¤¯à¥‹à¤—à¥€ à¤¸à¥à¤à¤¾à¤µ',
    startTourBtn: 'Interactive Tutorial',
    takeTourBadge: 'à¤‡à¤‚à¤Ÿà¤°à¥ˆà¤•à¥à¤Ÿà¤¿à¤µ à¤Ÿà¥‚à¤°',
    bannerTitle: 'à¤•à¥à¤¯à¤¾ à¤†à¤ª à¤¹à¤° à¤¬à¤Ÿà¤¨ à¤•à¤¾ à¤²à¤¾à¤‡à¤µ à¤Ÿà¥à¤¯à¥‚à¤Ÿà¥‹à¤°à¤¿à¤¯à¤² à¤¦à¥‡à¤–à¤¨à¤¾ à¤šà¤¾à¤¹à¤¤à¥‡ à¤¹à¥ˆà¤‚?',
    bannerDesc: 'à¤¯à¤¹ à¤‡à¤‚à¤Ÿà¤°à¥ˆà¤•à¥à¤Ÿà¤¿à¤µ à¤Ÿà¥‚à¤° à¤¸à¥à¤•à¥à¤°à¥€à¤¨ à¤•à¥‡ à¤¹à¤° à¤¬à¤Ÿà¤¨ à¤•à¥‹ à¤¹à¤¾à¤‡à¤²à¤¾à¤‡à¤Ÿ à¤•à¤°à¤•à¥‡ à¤‰à¤¸à¤•à¥‡ à¤•à¤¾à¤® à¤•à¥‹ à¤µà¤¿à¤¸à¥à¤¤à¤¾à¤° à¤¸à¥‡ à¤¸à¤®à¤à¤¾à¤à¤—à¤¾à¥¤',
    close: 'à¤¬à¤‚à¤¦ à¤•à¤°à¥‡à¤‚',
    clickToSpotlight: 'à¤‡à¤¸ à¤¬à¤Ÿà¤¨ à¤•à¥‹ à¤¹à¤¾à¤‡à¤²à¤¾à¤‡à¤Ÿ à¤•à¤°à¥‡à¤‚',
    allLanguages: 'à¤­à¤¾à¤·à¤¾ à¤¬à¤¦à¤²à¥‡à¤‚',
  },
  gu: {
    guideTitle: 'àª«à«€àªšàª° àª®àª¾àª°à«àª—àª¦àª°à«àª¶àª¿àª•àª¾',
    inSimpleTerms: 'àª¸àª°àª³ àª¶àª¬à«àª¦à«‹àª®àª¾àª‚ àª¸àª®àªœà«‹',
    whyItMatters: 'àª† àª•à«‡àª® àª®àª¹àª¤à«àªµàªªà«‚àª°à«àª£ àª›à«‡',
    howItWorks: 'àª•àª¾àª® àª•àª°àªµàª¾àª¨à«€ àªªàª¦à«àª§àª¤àª¿ (Workflow)',
    buttonsExplained: 'àª† àª¸à«àª•à«àª°à«€àª¨ àªªàª°àª¨àª¾ àª¤àª®àª¾àª® àª¬àªŸàª¨à«‹ àª…àª¨à«‡ àª¤à«‡àª®àª¨à«€ àª•àª¾àª®àª—à«€àª°à«€',
    proTipsTitle: 'àª¸à«€àª àªªà«àª°à«‡àª•à«àªŸàª¿àª¸ àª‰àªªàª¯à«‹àª—à«€ àªŸàª¿àªªà«àª¸',
    startTourBtn: 'Interactive Tutorial',
    takeTourBadge: 'àª‡àª¨à«àªŸàª°à«‡àª•à«àªŸàª¿àªµ àªŸà«‚àª°',
    bannerTitle: 'àª¶à«àª‚ àª¤àª®à«‡ àª¦àª°à«‡àª• àª¬àªŸàª¨àª¨à«àª‚ àª²àª¾àªˆàªµ àªŸà«àª¯à«àªŸà«‹àª°àª¿àª¯àª² àªœà«‹àªµàª¾ àª®àª¾àª‚àª—à«‹ àª›à«‹?',
    bannerDesc: 'àª† àªŸà«‚àª° àª¸à«àª•à«àª°à«€àª¨ àªªàª°àª¨àª¾ àª¦àª°à«‡àª• àª¬àªŸàª¨àª¨à«‡ àª¹àª¾àª‡àª²àª¾àª‡àªŸ àª•àª°à«€àª¨à«‡ àª¤à«‡àª¨à«àª‚ àª•àª¾àª°à«àª¯ àª¸àª°àª³ àª°à«€àª¤à«‡ àª¸àª®àªœàª¾àªµàª¶à«‡.',
    close: 'àª¬àª‚àª§ àª•àª°à«‹',
    clickToSpotlight: 'àª† àª¬àªŸàª¨ àª¹àª¾àª‡àª²àª¾àª‡àªŸ àª•àª°à«‹',
    allLanguages: 'àª­àª¾àª·àª¾ àª¬àª¦àª²à«‹',
  },
  mr: {
    guideTitle: 'à¤µà¥ˆà¤¶à¤¿à¤·à¥à¤Ÿà¥à¤¯à¥‡ à¤µ à¤®à¤¾à¤°à¥à¤—à¤¦à¤°à¥à¤¶à¤•',
    inSimpleTerms: 'à¤¸à¥‹à¤ªà¥à¤¯à¤¾ à¤­à¤¾à¤·à¥‡à¤¤ à¤¸à¤®à¤œà¥‚à¤¨ à¤˜à¥à¤¯à¤¾',
    whyItMatters: 'à¤¹à¥‡ à¤•à¤¾ à¤®à¤¹à¤¤à¥à¤¤à¥à¤µà¤¾à¤šà¥‡ à¤†à¤¹à¥‡',
    howItWorks: 'à¤•à¤¾à¤°à¥à¤¯à¤ªà¤¦à¥à¤§à¤¤à¥€ (Workflow)',
    buttonsExplained: 'à¤¯à¤¾ à¤¸à¥à¤•à¥à¤°à¥€à¤¨à¤µà¤°à¥€à¤² à¤¸à¤°à¥à¤µ à¤¬à¤Ÿà¤¨à¥‡ à¤†à¤£à¤¿ à¤¤à¥à¤¯à¤¾à¤‚à¤šà¥€ à¤•à¤¾à¤°à¥à¤¯à¥‡',
    proTipsTitle: 'à¤¸à¥€à¤ à¤«à¤°à¥à¤® à¤‰à¤ªà¤¯à¥à¤•à¥à¤¤ à¤Ÿà¤¿à¤ªà¥à¤¸',
    startTourBtn: 'Interactive Tutorial',
    takeTourBadge: 'à¤‡à¤‚à¤Ÿà¤°à¥…à¤•à¥à¤Ÿà¤¿à¤µà¥à¤¹ à¤Ÿà¥‚à¤°',
    bannerTitle: 'à¤†à¤ªà¤²à¥à¤¯à¤¾à¤²à¤¾ à¤ªà¥à¤°à¤¤à¥à¤¯à¥‡à¤• à¤¬à¤Ÿà¤£à¤¾à¤šà¥‡ à¤¥à¥‡à¤Ÿ à¤Ÿà¥à¤¯à¥à¤Ÿà¥‹à¤°à¤¿à¤¯à¤² à¤ªà¤¹à¤¾à¤¯à¤šà¥‡ à¤†à¤¹à¥‡ à¤•à¤¾?',
    bannerDesc: 'à¤¹à¤¾ à¤ªà¤°à¤¸à¥à¤ªà¤°à¤¸à¤‚à¤µà¤¾à¤¦à¥€ à¤Ÿà¥‚à¤° à¤¸à¥à¤•à¥à¤°à¥€à¤¨à¤µà¤°à¥€à¤² à¤ªà¥à¤°à¤¤à¥à¤¯à¥‡à¤• à¤¬à¤Ÿà¤£à¤¾à¤µà¤° à¤ªà¥à¤°à¤•à¤¾à¤¶ à¤Ÿà¤¾à¤•à¥‚à¤¨ à¤¤à¥à¤¯à¤¾à¤šà¥‡ à¤•à¤¾à¤® à¤¸à¤®à¤œà¤¾à¤µà¥‚à¤¨ à¤¸à¤¾à¤‚à¤—à¥‡à¤².',
    close: 'à¤¬à¤‚à¤¦ à¤•à¤°à¤¾',
    clickToSpotlight: 'à¤¹à¥‡ à¤¬à¤Ÿà¤£ à¤¦à¤¾à¤–à¤µà¤¾',
    allLanguages: 'à¤­à¤¾à¤·à¤¾ à¤¬à¤¦à¤²à¤¾',
  },
};

export function FeatureGuideModal() {
  const { isGuideOpen, closeGuide, activeGuideFeature, startTour, currentFeatureKey } =
    useFeatureGuide();
  const { language, setLanguage, languages } = useLanguage();
  const navigate = useNavigate();

  const currentGuide = FEATURE_GUIDES[activeGuideFeature] ?? FEATURE_GUIDES.dashboard;
  const content = currentGuide.translations[language] ?? currentGuide.translations.en;
  const ui = UI_TEXT[language] ?? UI_TEXT.en;

  const languageActions = languages.map((lang) => ({
    id: lang.code,
    label: `${lang.name} (${lang.englishName})`,
    icon: (
      <span className="flex h-4 w-4 items-center justify-center">
        {language === lang.code ? (
          <Check className="h-3.5 w-3.5 text-[var(--fd-accent)]" />
        ) : null}
      </span>
    ),
    onSelect: () => {
      setLanguage(lang.code);
    },
  }));

  const activeLangMeta = languages.find((l) => l.code === language) ?? languages[0]!;

  return (
    <RadixDialog.Root open={isGuideOpen} onOpenChange={(open) => !open && closeGuide()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[var(--fd-overlay)] backdrop-blur-xs transition-opacity" />
        <RadixDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] shadow-2xl overflow-hidden outline-none',
          )}
        >
          {/* Header Bar - Fixed layout with Language and Tutorial controls pinned at top-right corner */}
          <div className="flex items-center justify-between gap-3 sm:gap-4 border-b border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)]/80 px-4 sm:px-6 py-3.5 sm:py-4">
            {/* Feature Icon, Title, Badge & Subtitle */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--fd-accent)] to-[#B84E00] text-[var(--fd-accent-contrast)] shadow-md">
                {ICON_MAP[currentGuide.iconName] ?? <BookOpen className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <RadixDialog.Title className="text-base sm:text-lg font-semibold text-[var(--fd-text-primary)] truncate">
                    {content.title}
                  </RadixDialog.Title>
                  <span className="hidden lg:inline-flex rounded-full bg-[var(--fd-accent-subtle-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--fd-accent)] border border-[var(--fd-accent)]/20 shrink-0">
                    {content.badge}
                  </span>
                </div>
                <RadixDialog.Description className="text-xs text-[var(--fd-text-tertiary)] truncate">
                  {content.subtitle}
                </RadixDialog.Description>
              </div>
            </div>

            {/* Top Right Corner: Language Selector & Interactive Tutorial Controls */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              {/* Language Switcher Dropdown */}
              <DropdownMenu
                ariaLabel="Select Explanation Language"
                align="end"
                actions={languageActions}
                trigger={
                  <button
                    type="button"
                    aria-label={`Current language: ${activeLangMeta.name}. Click to change language.`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-2.5 sm:px-3 text-xs font-semibold text-[var(--fd-text-primary)] shadow-2xs transition-colors hover:bg-[var(--fd-surface-3)] focus-visible:outline-2 focus-visible:outline-[var(--fd-focus-ring)] shrink-0 cursor-pointer"
                  >
                    <Globe className="h-3.5 w-3.5 text-[var(--fd-accent)] shrink-0" aria-hidden="true" />
                    <span>{activeLangMeta.name}</span>
                  </button>
                }
              />

              {/* Interactive Tutorial Button - Always in English and locked at the top-right corner */}
              <button
                type="button"
                onClick={() => startTour(activeGuideFeature)}
                aria-label="Interactive Tutorial"
                className={cn(
                  'relative group inline-flex h-9 items-center gap-2 rounded-lg px-3 sm:px-3.5 text-xs font-bold text-white shadow-sm transition-all shrink-0 cursor-pointer',
                  'bg-gradient-to-r from-[var(--fd-accent)] via-[#FF8A1F] to-[#B84E00] hover:from-[var(--fd-accent-hover)] hover:to-[#C24F00]',
                  'focus-visible:outline-2 focus-visible:outline-[var(--fd-focus-ring)] focus-visible:outline-offset-2',
                )}
              >
                <Play className="h-3 w-3 fill-current shrink-0" aria-hidden="true" />
                <span>Interactive Tutorial</span>
                <span className="hidden sm:inline-block rounded bg-white/20 px-1 py-0.2 text-[9px] font-medium uppercase tracking-wider">
                  Tour
                </span>
              </button>

              {/* Modal Close Button */}
              <RadixDialog.Close asChild>
                <button
                  type="button"
                  aria-label={ui.close}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fd-text-tertiary)] transition-colors hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)] shrink-0 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </RadixDialog.Close>
            </div>
          </div>

          {/* Scrollable Body Content */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
            {/* Context Notice if viewing another feature's guide with 1-click jump button */}
            {activeGuideFeature !== currentFeatureKey && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--fd-accent)]/30 bg-[var(--fd-accent-subtle-bg)]/60 px-4 py-3">
                <div className="flex items-center gap-2.5 text-xs text-[var(--fd-text-primary)]">
                  <Sparkles className="h-4 w-4 text-[var(--fd-accent)] shrink-0" />
                  <span>
                    Viewing guide for <strong>{content.title}</strong>. Want to open that screen?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    closeGuide();
                    void navigate(currentGuide.defaultRoute);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fd-accent)] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-90 transition-all shrink-0 cursor-pointer"
                >
                  <span>Go to {content.title.split(' ')[0]}</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* In Simple Words Banner */}
            <section className="rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)]/60 p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--fd-accent-subtle-bg)] text-[var(--fd-accent)]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--fd-accent)]">
                    {ui.inSimpleTerms}
                  </h3>
                  <p className="text-base leading-relaxed text-[var(--fd-text-primary)]">
                    {content.simpleExplanation}
                  </p>
                </div>
              </div>
            </section>

            {/* Why This Matters */}
            <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-1">
                    {ui.whyItMatters}
                  </h4>
                  <p className="text-sm text-[var(--fd-text-secondary)] leading-relaxed">
                    {content.whyItMatters}
                  </p>
                </div>
              </div>
            </section>

            {/* How It Works - 3 Step Workflow */}
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fd-text-tertiary)]">
                {ui.howItWorks}
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {content.howItWorks.map((step) => (
                  <div
                    key={step.stepNumber}
                    className="flex flex-col justify-between rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-2)]/40 p-4 transition-all hover:border-[var(--fd-border-strong)]"
                  >
                    <div className="space-y-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--fd-accent)]/15 text-xs font-bold text-[var(--fd-accent)]">
                        {step.stepNumber}
                      </span>
                      <h4 className="text-sm font-semibold text-[var(--fd-text-primary)]">
                        {step.title}
                      </h4>
                      <p className="text-xs text-[var(--fd-text-secondary)] leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Buttons on this screen explained */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fd-text-tertiary)]">
                  {ui.buttonsExplained}
                </h3>
                <span className="text-[11px] text-[var(--fd-text-tertiary)]">
                  {content.buttons.length} controls on this screen
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {content.buttons.map((btn, idx) => (
                  <div
                    key={btn.id}
                    className="group flex flex-col justify-between rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-2)]/50 p-4 transition-all hover:border-[var(--fd-accent)] hover:shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--fd-surface-3)] text-[var(--fd-accent)] font-semibold text-xs border border-[var(--fd-border)]">
                            #{idx + 1}
                          </span>
                          <h4 className="text-sm font-semibold text-[var(--fd-text-primary)]">
                            {btn.name}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            startTour(activeGuideFeature);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-medium text-[var(--fd-accent)] hover:underline flex items-center gap-1"
                        >
                          <Play className="h-2.5 w-2.5 fill-current" />
                          <span>Tour</span>
                        </button>
                      </div>

                      <p className="text-xs text-[var(--fd-text-secondary)] leading-relaxed mb-2">
                        {btn.description}
                      </p>
                    </div>

                    {btn.proTip && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-[var(--fd-surface-3)]/60 px-2.5 py-1.5 text-[11px] text-[var(--fd-text-tertiary)] border border-[var(--fd-border-subtle)]">
                        <Lightbulb className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                        <span>{btn.proTip}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Pro Tips Section */}
            {content.proTips && content.proTips.length > 0 && (
              <section className="space-y-2 rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)]/40 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fd-accent)] flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                  {ui.proTipsTitle}
                </h3>
                <ul className="space-y-1.5 text-xs text-[var(--fd-text-secondary)]">
                  {content.proTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[var(--fd-accent)] font-bold">&bull;</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Bottom Call to Action Banner to Launch Tour */}
            <div className="rounded-xl border border-[var(--fd-accent)]/30 bg-gradient-to-r from-[var(--fd-accent)]/10 via-[#FF8A1F]/10 to-[var(--fd-accent)]/10 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-bold text-[var(--fd-text-primary)]">
                  {ui.bannerTitle}
                </h4>
                <p className="text-xs text-[var(--fd-text-secondary)] max-w-xl">
                  {ui.bannerDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => startTour(activeGuideFeature)}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--fd-accent)] px-4 py-2 text-xs font-bold text-[var(--fd-accent-contrast)] shadow-md hover:bg-[var(--fd-accent-hover)] transition-all shrink-0"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{ui.startTourBtn}</span>
              </button>
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
