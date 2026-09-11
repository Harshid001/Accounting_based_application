import {
  CheckCircle2,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { JVLogoMark } from '@/components/brand/JVLogo';

export function DualExperienceSection() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fd-accent-subtle-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--fd-accent)] uppercase tracking-wider">
            The Clear Choice
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--fd-text-primary)] sm:text-4xl">
            Traditional Accounting Firms vs. Partnering With JV Tax Consultancy
          </h2>
          <p className="mt-3 text-base text-[var(--fd-text-secondary)]">
            See how our modern, institutional approach transforms financial governance from a stressful chore
            into your business&apos;s greatest strategic asset.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Column 1: Traditional CA Firms */}
          <div className="rounded-2xl border border-[var(--fd-status-danger)]/20 bg-[var(--fd-status-danger)]/5 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--fd-status-danger)]/15 text-[var(--fd-status-danger)]">
                  <ShieldAlert className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--fd-status-danger)]">
                    The Legacy Status Quo
                  </span>
                  <h3 className="text-xl font-bold text-[var(--fd-text-primary)]">Traditional Accounting Firms</h3>
                </div>
              </div>

              <p className="mt-4 text-xs sm:text-sm text-[var(--fd-text-secondary)] leading-relaxed">
                Characterized by friction, opaque processes, and reactive deadline scrambles that put your business at risk of penalties.
              </p>

              <ul className="mt-6 space-y-4 text-xs sm:text-sm text-[var(--fd-text-secondary)]">
                <li className="flex items-start gap-3">
                  <XCircle className="h-4 w-4 shrink-0 text-[var(--fd-status-danger)] mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-[var(--fd-text-primary)]">Disorganized WhatsApp Groups:</strong> Critical financial
                    spreadsheets, bills, and PAN copies scattered across unencrypted chat logs.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="h-4 w-4 shrink-0 text-[var(--fd-status-danger)] mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-[var(--fd-text-primary)]">11th-Hour Tax Panics:</strong> Filings rushed hours before
                    midnight deadlines, leading to Input Tax Credit (ITC) errors and GST mismatch notices.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="h-4 w-4 shrink-0 text-[var(--fd-status-danger)] mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-[var(--fd-text-primary)]">Unsupervised Delegation:</strong> High-stakes accounting
                    delegated to inexperienced article trainees with little senior oversight.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="h-4 w-4 shrink-0 text-[var(--fd-status-danger)] mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-[var(--fd-text-primary)]">Document Chasing Scramble:</strong> Calling repeatedly
                    for bank loan documents or filed ITR acknowledgements when urgent.
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-8 rounded-lg bg-[var(--fd-status-danger)]/10 border border-[var(--fd-status-danger)]/20 p-3 text-xs text-[var(--fd-status-danger)] font-medium">
              High risk of late fees, blocked ITC credits, and surprise departmental tax notices.
            </div>
          </div>

          {/* Column 2: Partnering With JV Tax Consultancy */}
          <div className="rounded-2xl border border-[var(--fd-accent)]/50 bg-gradient-to-b from-[var(--fd-surface-1)] to-[var(--fd-surface-2)] p-6 sm:p-8 flex flex-col justify-between shadow-lg relative overflow-hidden">
            <div className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-[var(--fd-accent)]/15 blur-2xl" />

            <div>
              <div className="flex items-center gap-3">
                <JVLogoMark size={42} />
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--fd-accent)]">
                    The Modern Standard
                  </span>
                  <h3 className="text-xl font-bold text-[var(--fd-text-primary)]">Partnering With JV Tax Consultancy</h3>
                </div>
              </div>

              <p className="mt-4 text-xs sm:text-sm text-[var(--fd-text-secondary)] leading-relaxed">
                Institutional precision, digital clarity, and senior advisory that gives founders and leadership teams genuine peace of mind.
              </p>

              <ul className="mt-6 space-y-4 text-xs sm:text-sm text-[var(--fd-text-secondary)]">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--fd-status-done)] mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-[var(--fd-text-primary)]">24/7 Digital Client Portal:</strong> All filings, tax
                    challans, and stamped receipts centralized in your private, securely encrypted dashboard.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--fd-status-done)] mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-[var(--fd-text-primary)]">120-Day Predictive Horizon:</strong> All statutory
                    returns planned weeks in advance, eliminating penalties, interest, and last-minute scrambles.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--fd-status-done)] mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-[var(--fd-text-primary)]">Senior CA Dual-Tier Scrutiny:</strong> Every return,
                    balance sheet, and tax deduction is audited by senior practitioners before government filing.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--fd-status-done)] mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-[var(--fd-text-primary)]">Multi-Entity & JV Architecture:</strong> Manage sister
                    concerns, joint ventures, and director returns under one unified corporate overview.
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-8 rounded-lg bg-[var(--fd-status-done)]/10 border border-[var(--fd-status-done)]/20 p-3 text-xs text-[var(--fd-status-done)] font-medium flex items-center justify-between">
              <span>Dedicated to timely statutory compliance & professional diligence</span>
              <a href="#consultation" className="font-bold underline hover:text-[#6EE7B7]">
                Partner with us â†’
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
