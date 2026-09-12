import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Sparkles, UserCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function CtaBanner() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--fd-border)] bg-gradient-to-b from-[var(--fd-surface-1)] to-[var(--fd-surface-2)] p-8 sm:p-12 lg:p-16 text-center shadow-xl">
          {/* Subtle Glow */}
          <div
            className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-96 -translate-x-1/2 rounded-full bg-[var(--fd-accent)]/20 blur-3xl"
            aria-hidden="true"
          />

          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-3 py-1 text-xs font-semibold text-[var(--fd-accent)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Proactive Compliance · Dedicated Advisory</span>
          </div>

          <h2 className="mt-4 text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--fd-text-primary)] leading-tight">
            Ready for Dependable Accounting & Seamless Statutory Compliance?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-[var(--fd-text-secondary)]">
            Partner with dedicated Chartered Accountants who treat your balance sheet with institutional precision.
            Eliminate compliance stress and gain 24/7 financial transparency through our dedicated Client Portal.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Button asChild variant="primary" size="lg" className="w-full sm:w-auto shadow-md">
              <a href="#consultation" className="flex items-center justify-center gap-2">
                <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                <span>Book Your Free Consultation</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>

            <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
              <Link to="/sign-in?portal=client" className="flex items-center justify-center gap-2">
                <UserCheck className="h-4 w-4 text-[var(--fd-accent)]" aria-hidden="true" />
                <span>Client Portal Sign In</span>
              </Link>
            </Button>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-[var(--fd-text-tertiary)]">
            <span>✓ Transparent Pricing</span>
            <span>✓ Non-Disclosure Agreement (NDA) Protected</span>
            <span>✓ Structured Onboarding Migration</span>
          </div>
        </div>
      </div>
    </section>
  );
}
