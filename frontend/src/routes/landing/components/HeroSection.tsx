import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  CalendarCheck,
  ChevronRight,
  Lock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { JVLogoMark } from '@/components/brand/JVLogo';

export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden pt-10 pb-12 md:pt-16 md:pb-20">
      {/* 1. Atmospheric Accounting & Advisory Workspace Background */}
      <div className="pointer-events-none absolute inset-0 -z-30 overflow-hidden select-none">
        <img
          src="/images/Gemini_Generated_Image_uj90t7uj90t7uj90.png"
          alt="JV Tax Consultancy executive financial intelligence workspace"
          className="h-full w-full object-cover object-[center_35%] md:object-[center_28%] filter contrast-[1.08] saturate-[1.1] brightness-[0.92] dark:brightness-[0.55] dark:contrast-[1.12]"
        />
        {/* Light mode overlay: soft vignette preserving the monitor, desk, and office ambiance */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/50 to-[var(--fd-bg)] dark:hidden block" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.82)_0%,rgba(255,255,255,0.40)_60%,rgba(255,255,255,0.85)_100%)] dark:hidden block" />

        {/* Dark mode overlay: cinematic obsidian tone allowing screen charts and warm wood to shine through */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/75 via-[#0a0a0a]/45 to-[#0a0a0a] hidden dark:block" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,10,10,0.72)_0%,rgba(10,10,10,0.30)_60%,rgba(10,10,10,0.85)_100%)] hidden dark:block" />
      </div>

      {/* 2. Oversized Subtle JV Brand Monogram Watermark */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-20 -translate-x-1/2 -translate-y-1/2 opacity-[0.035] scale-150 select-none blur-[0.5px]"
        aria-hidden="true"
      >
        <JVLogoMark size={640} />
      </div>

      {/* 3. Subtle Brand Radial Glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-[#FF6A00]/12 via-[var(--fd-accent)]/8 to-[#FFB15C]/8 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          {/* Prominent JV Tax Consultancy Official Brand Badge */}
          <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 rounded-full border border-[var(--fd-accent)]/30 bg-[var(--fd-surface-1)]/90 px-3.5 py-1.5 shadow-md backdrop-blur-md transition-all hover:border-[var(--fd-accent)]/50">
            <JVLogoMark size={22} badge />
            <span className="text-[11px] sm:text-xs font-bold tracking-wider text-[var(--fd-accent)] dark:text-[#FFB15C] uppercase">
              JV Tax Consultancy
            </span>
            <span className="h-3 w-px bg-[var(--fd-border)]" />
            <span className="text-[11px] sm:text-xs font-medium text-[var(--fd-text-secondary)]">
              Chartered Advisory & Audit Practice
            </span>
            <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-[var(--fd-surface-2)] px-2 py-0.5 text-[10px] font-mono text-[var(--fd-text-tertiary)] border border-[var(--fd-border-subtle)]">
              ICAI Governed
            </span>
            <ChevronRight className="h-3 w-3 text-[var(--fd-text-tertiary)]" aria-hidden="true" />
          </div>

          {/* Main Hero Heading — Perfectly Balanced 2-Line Architecture */}
          <h1 className="mt-6 text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-extrabold tracking-tight text-[var(--fd-text-primary)] leading-[1.15] sm:leading-[1.12] break-words">
            <span>Strategic Accounting & Corporate Tax</span>
            <span className="block mt-1 sm:mt-2 bg-gradient-to-r from-[#FFB15C] via-[var(--fd-accent)] to-[#FF8A1F] dark:from-[#F5F2ED] dark:via-[#FFB15C] dark:to-[#FF8A1F] bg-clip-text text-transparent">
              Engineered for High-Growth Enterprises
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-5 mx-auto max-w-3xl text-sm sm:text-base lg:text-lg leading-relaxed text-[var(--fd-text-secondary)]">
            From daily cloud bookkeeping and GST/TDS returns to statutory audits, strategic corporate tax planning,
            and Virtual CFO advisory. We eliminate statutory penalty risk, protect corporate margins, and furnish 24/7 digital transparency
            through our dedicated Client Portal.
          </p>

          {/* Call to Actions */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Button
              asChild
              variant="primary"
              size="lg"
              className="w-full sm:w-auto shadow-lg shadow-black/40 bg-[var(--fd-accent)] hover:bg-[var(--fd-accent-hover)] text-[var(--fd-accent-contrast)] font-semibold px-6 border border-[var(--fd-accent)]/30 transition-all hover:scale-[1.01] hover:shadow-[0_8px_32px_-8px_rgba(255,106,0,0.5)]"
            >
              <a href="#consultation" className="flex items-center justify-center gap-2">
                <CalendarCheck className="h-4 w-4 opacity-80" aria-hidden="true" />
                <span>Schedule Free Advisory Call</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>

            <Button
              asChild
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto bg-[var(--fd-surface-1)] hover:bg-[var(--fd-surface-2)] text-[var(--fd-text-primary)] border border-[var(--fd-border)] hover:border-[var(--fd-accent)] hover:text-[var(--fd-accent-hover)] shadow-xs backdrop-blur-md px-6 transition-all hover:scale-[1.01]"
            >
              <Link to="/sign-in?portal=client" className="flex items-center justify-center gap-2">
                <UserCheck className="h-4 w-4 text-[var(--fd-accent)]" aria-hidden="true" />
                <span>Client Portal Sign In</span>
              </Link>
            </Button>
          </div>

          {/* Institutional Reassurance Badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-xs">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--fd-border)] bg-[var(--fd-surface-1)]/80 backdrop-blur-sm px-3.5 py-1.5 text-[var(--fd-text-secondary)] shadow-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--fd-accent)] shrink-0" aria-hidden="true" />
              <span className="font-medium">ICAI Code of Ethics Governed</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--fd-border)] bg-[var(--fd-surface-1)]/80 backdrop-blur-sm px-3.5 py-1.5 text-[var(--fd-text-secondary)] shadow-xs">
              <Award className="h-3.5 w-3.5 text-[var(--fd-accent)] shrink-0" aria-hidden="true" />
              <span className="font-medium">Senior CA Supervised Advisory</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--fd-border)] bg-[var(--fd-surface-1)]/80 backdrop-blur-sm px-3.5 py-1.5 text-[var(--fd-text-secondary)] shadow-xs">
              <Lock className="h-3.5 w-3.5 text-[var(--fd-accent)] shrink-0" aria-hidden="true" />
              <span className="font-medium">AES-256 Cloud Vault & NDA Protected</span>
            </div>
          </div>
        </div>

        {/* Highlight Capability Cards — Institutional & Cohesive */}
        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          <div className="rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)]/80 p-3 sm:p-5 text-left shadow-sm backdrop-blur-md transition-all duration-200 hover:border-[var(--fd-accent)] hover:bg-[var(--fd-surface-2)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(255,106,0,0.15)]">
            <div className="flex items-center justify-between">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--fd-text-primary)]">Dual-Tier</span>
              <span className="h-2 w-2 rounded-full bg-[var(--fd-accent)]" aria-hidden="true" />
            </div>
            <div className="mt-1.5 text-xs font-semibold text-[var(--fd-text-secondary)]">Audit Scrutiny</div>
            <div className="mt-1 text-[11px] text-[var(--fd-text-tertiary)] leading-normal">Senior CA verification prior to statutory filing</div>
          </div>

          <div className="rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)]/80 p-3 sm:p-5 text-left shadow-sm backdrop-blur-md transition-all duration-200 hover:border-[var(--fd-accent)] hover:bg-[var(--fd-surface-2)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(255,106,0,0.15)]">
            <div className="flex items-center justify-between">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--fd-text-primary)]">100%</span>
              <span className="h-2 w-2 rounded-full bg-[#FFB15C]" aria-hidden="true" />
            </div>
            <div className="mt-1.5 text-xs font-semibold text-[var(--fd-text-secondary)]">Statutory Accuracy</div>
            <div className="mt-1 text-[11px] text-[var(--fd-text-tertiary)] leading-normal">Zero-penalty track record across GST & Direct Tax</div>
          </div>

          <div className="rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)]/80 p-3 sm:p-5 text-left shadow-sm backdrop-blur-md transition-all duration-200 hover:border-[var(--fd-accent)] hover:bg-[var(--fd-surface-2)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(255,106,0,0.15)]">
            <div className="flex items-center justify-between">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--fd-text-primary)]">24/7</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
            </div>
            <div className="mt-1.5 text-xs font-semibold text-[var(--fd-text-secondary)]">Digital Transparency</div>
            <div className="mt-1 text-[11px] text-[var(--fd-text-tertiary)] leading-normal">Live statutory radar, ledger feeds & filed receipts</div>
          </div>

          <div className="rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)]/80 p-3 sm:p-5 text-left shadow-sm backdrop-blur-md transition-all duration-200 hover:border-[var(--fd-accent)] hover:bg-[var(--fd-surface-2)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(255,106,0,0.15)]">
            <div className="flex items-center justify-between">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--fd-text-primary)]">Strategic</span>
              <span className="h-2 w-2 rounded-full bg-[var(--fd-text-secondary)]" aria-hidden="true" />
            </div>
            <div className="mt-1.5 text-xs font-semibold text-[var(--fd-text-secondary)]">Virtual CFO & Advisory</div>
            <div className="mt-1 text-[11px] text-[var(--fd-text-tertiary)] leading-normal">Corporate planning, financial models & MIS reporting</div>
          </div>
        </div>
      </div>
    </section>
  );
}
