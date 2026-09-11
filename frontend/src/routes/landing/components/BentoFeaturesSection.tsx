import {
  Calendar,
  CheckCircle2,
  FolderLock,
  Layers,
  Sparkles,
  Users2,
} from 'lucide-react';

export function BentoFeaturesSection() {
  return (
    <section id="firm-advantage" className="scroll-mt-20 py-16 lg:py-24 border-t border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fd-accent-subtle-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--fd-accent)] uppercase tracking-wider">
            The JV Tax Consultancy Advantage
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--fd-text-primary)] sm:text-4xl">
            Why Forward-Thinking Enterprises Partner With Us
          </h2>
          <p className="mt-3 text-base text-[var(--fd-text-secondary)] leading-relaxed">
            Traditional accounting firms rely on messy WhatsApp threads, unencrypted email attachments, and last-minute
            deadline panics. We combine elite statutory expertise with digital transparency so you always know where your business stands.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-[var(--fd-text-tertiary)]">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fd-surface-2)] px-2.5 py-1 font-mono text-[11px] text-[var(--fd-text-secondary)] border border-[var(--fd-border-subtle)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--fd-accent)]" />
              Senior Partner Supervision
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fd-surface-2)] px-2.5 py-1 font-mono text-[11px] text-[var(--fd-text-secondary)] border border-[var(--fd-border-subtle)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--fd-status-done)]" />
              Zero Filing Penalties
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fd-surface-2)] px-2.5 py-1 font-mono text-[11px] text-[var(--fd-text-secondary)] border border-[var(--fd-border-subtle)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--fd-status-progress)]" />
              Direct Portal Visibility
            </span>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Large Featured Card (2 cols on md) with Audit Desk Watermark */}
          <div className="md:col-span-2 rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-bg)] p-6 sm:p-8 relative overflow-hidden group hover:border-[var(--fd-accent)] transition-all">
            {/* Subtle Statutory Audit Desk Watermark Background */}
            <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden rounded-2xl select-none">
              <img
                src="/images/why-us/statutory_audit_desk.jpg"
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover object-right opacity-[0.10] mix-blend-luminosity filter contrast-125 transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--fd-bg)] via-[var(--fd-bg)]/85 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--fd-bg)] via-transparent to-transparent" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)]">
                  <Calendar className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="rounded-full border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-2 py-1 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-mono font-semibold text-[var(--fd-accent)]">
                  120-Day Predictive Horizon
                </span>
              </div>

            <h3 className="mt-5 text-xl font-bold text-[var(--fd-text-primary)] sm:text-2xl">
              Proactive Statutory Planning â€” Advanced Milestone Tracking
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fd-text-secondary)] max-w-full lg:max-w-xl">
              Our practice forecasts statutory milestones across the 120-day horizon. We notify your finance team
              weeks before GST, TDS, advance tax, or MCA cutoff dates, ensuring books are closed, reconciled, and audited
              ahead of government penalty windows.
            </p>

            {/* Visual simulation inside card */}
            <div className="mt-6 rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--fd-text-secondary)]">
                <span>Statutory Horizon Tracking for Your Entity:</span>
                <span className="text-[var(--fd-status-done)] font-mono flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Monitored & On Track
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 xs:grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-[var(--fd-surface-2)] p-2.5">
                  <div className="font-mono text-xs text-[var(--fd-accent)] font-bold">11th Â· GSTR-1</div>
                  <div className="text-[11px] text-[var(--fd-text-secondary)]">Prepared & Filed Early</div>
                </div>
                <div className="rounded-lg bg-[var(--fd-surface-2)] p-2.5">
                  <div className="font-mono text-xs text-[var(--fd-status-progress)] font-bold">20th Â· GSTR-3B</div>
                  <div className="text-[11px] text-[var(--fd-text-secondary)]">ITC 2B Reconciled</div>
                </div>
                <div className="rounded-lg bg-[var(--fd-surface-2)] p-2.5">
                  <div className="font-mono text-xs text-[var(--fd-accent)] font-bold">30th Â· Tax Audit</div>
                  <div className="text-[11px] text-[var(--fd-text-secondary)]">Partner Reviewed</div>
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* Card 2: 24/7 Digital Client Portal */}
          <div className="rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-bg)] p-6 sm:p-8 flex flex-col justify-between group hover:border-[var(--fd-accent)] transition-all">
            <div>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--fd-status-done)]/15 text-[var(--fd-status-done)]">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-[var(--fd-text-primary)]">
                24/7 Digital Client Portal
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-[var(--fd-text-secondary)] leading-relaxed">
                As our client, your leadership team gets dedicated portal access. Check filing statuses in real time,
                download official government acknowledgements, and review tax challans anytime.
              </p>
            </div>
            <div className="mt-6 rounded-lg bg-[var(--fd-surface-2)] p-3 text-[11px] font-mono text-[var(--fd-status-done)] flex items-center justify-between">
              <span>Client Dashboard Access</span>
              <span className="font-bold">Included</span>
            </div>
          </div>

          {/* Card 3: Encrypted Confidentiality */}
          <div className="rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-bg)] p-6 sm:p-8 flex flex-col justify-between group hover:border-[var(--fd-accent)] transition-all">
            <div>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--fd-accent)]/15 text-[var(--fd-accent)]">
                <FolderLock className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-[var(--fd-text-primary)]">
                Encrypted Data Vaults
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-[var(--fd-text-secondary)] leading-relaxed">
                Your balance sheets, salary registers, and identification documents are encrypted with AES-256-GCM.
                We operate under strict Non-Disclosure Agreements with tamper-evident audit logs.
              </p>
            </div>
            <div className="mt-6 rounded-lg bg-[var(--fd-surface-2)] p-3 text-[11px] font-mono text-[var(--fd-accent)] flex items-center justify-between">
              <span>AES-256-GCM</span>
              <span className="text-[10px] font-semibold">ENCRYPTED AT REST</span>
            </div>
          </div>

          {/* Card 4: Multi-Entity & Corporate Group Management */}
          <div className="rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-bg)] p-6 sm:p-8 flex flex-col justify-between group hover:border-[var(--fd-accent)] transition-all">
            <div>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--fd-status-progress)]/15 text-[var(--fd-status-progress)]">
                <Layers className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-[var(--fd-text-primary)]">
                Multi-Entity & Group Architecture
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-[var(--fd-text-secondary)] leading-relaxed">
                Seamlessly manage Private Limited companies, LLPs, subsidiaries, and individual director filings
                under one seamless ecosystem with consolidated intercompany tracking.
              </p>
            </div>
            <div className="mt-6 rounded-lg bg-[var(--fd-surface-2)] p-3 text-[11px] text-[var(--fd-text-secondary)] flex items-center justify-between">
              <span>Entity Switching:</span>
              <span className="text-[var(--fd-status-progress)] font-semibold font-mono">1-Click Fast Switch</span>
            </div>
          </div>

          {/* Card 5: Senior CA Partner Attention */}
          <div className="rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-bg)] p-6 sm:p-8 flex flex-col justify-between group hover:border-[var(--fd-accent)] transition-all">
            <div>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--fd-accent)]/15 text-[var(--fd-accent)]">
                <Users2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-[var(--fd-text-primary)]">
                Senior Partner Attention
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-[var(--fd-text-secondary)] leading-relaxed">
                No junior handoffs. Every filing, tax position, and advisory memo is personally reviewed and signed
                by experienced Chartered Accountants dedicated to your account.
              </p>
            </div>
            <div className="mt-6 rounded-lg bg-[var(--fd-surface-2)] p-3 text-[11px] text-[var(--fd-text-secondary)] flex items-center justify-between">
              <span>Review Standard:</span>
              <span className="text-[var(--fd-status-done)] font-semibold font-mono">Dual-Tier Verification</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
