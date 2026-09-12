import { Building2, CheckCircle2, Quote, Sparkles, Star } from 'lucide-react';

interface Testimonial {
  id: string;
  initials: string;
  initialsGradient: string;
  name: string;
  designation: string;
  company: string;
  location: string;
  entityType: string;
  quote: string;
  metricsBadge: string;
}

export function TestimonialsSection() {
  const testimonials: Testimonial[] = [
    {
      id: 'apex-infra',
      initials: 'MS',
      initialsGradient: 'from-[var(--fd-status-done)]/20 to-[var(--fd-accent)]/20 text-[var(--fd-status-done)] border-[var(--fd-status-done)]/30',
      name: 'Manish Shah',
      designation: 'Managing Director',
      company: 'Apex Infra Projects JV',
      location: 'Ahmedabad / Patan, Gujarat',
      entityType: 'Joint Venture Consortium',
      quote:
        'Before partnering with JV Tax Consultancy, our consortium had recurring GST reconciliation mismatches and partner profit distribution disputes. Their team established rigorous sub-contractor TDS controls and the Client Portal gives both venture partners 24/7 visibility into filed challans and ARN receipts. Truly institutional discipline.',
      metricsBadge: 'Joint Venture Audit Â· 100% Reconciliation',
    },
    {
      id: 'mehsana-agro',
      initials: 'AP',
      initialsGradient: 'from-[var(--fd-status-progress)]/20 to-[var(--fd-accent)]/20 text-[var(--fd-status-progress)] border-[var(--fd-status-progress)]/30',
      name: 'Aarav Patel',
      designation: 'Chief Financial Officer',
      company: 'Mehsana Agro Processing Ltd',
      location: 'Mehsana, Gujarat',
      entityType: 'Manufacturing Enterprise',
      quote:
        'Their 120-day predictive statutory radar completely eliminated deadline anxiety for our board. Monthly book closings are completed within 5 business days, and our GSTR-9 annual returns go through seamlessly. The portal upload system replaced messy email attachments with encrypted vault certainty.',
      metricsBadge: 'Zero Delayed Filings in 3 Years',
    },
    {
      id: 'kutch-logistics',
      initials: 'DM',
      initialsGradient: 'from-[var(--fd-accent)]/20 to-[#FFB15C]/20 text-[var(--fd-accent)] border-[var(--fd-accent)]/30',
      name: 'Deepa Mehta',
      designation: 'Founder & Designated Partner',
      company: 'Kutch Logistics & Warehousing LLP',
      location: 'Gandhidham / Patan, Gujarat',
      entityType: 'Multi-Branch LLP',
      quote:
        'The senior CA partner attention is what sets them apart. Whether modeling partner remuneration caps under Section 40(b) or structuring inter-state GST logistics credits, we receive authoritative, institutional guidance. We have experienced zero statutory penalties across four continuous years.',
      metricsBadge: 'Virtual CFO & LLP Compliance',
    },
  ];

  return (
    <section id="testimonials" className="scroll-mt-20 py-16 lg:py-24 border-t border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fd-accent-subtle-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--fd-accent)] uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-[var(--fd-accent)]" />
            <span>JV Tax Consultancy Client Trust</span>
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--fd-text-primary)] sm:text-4xl">
            Trusted by Growing Enterprises & Companies Across Gujarat
          </h2>
          <p className="mt-3 text-base text-[var(--fd-text-secondary)]">
            Read how leaders in manufacturing, infrastructure consortiums, and LLPs experience total compliance peace of mind
            and digital visibility through the JV Tax Consultancy chartered advisory team.
          </p>
        </div>

        {/* 3 Testimonials Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="relative flex flex-col justify-between rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-bg)] p-6 sm:p-7 shadow-sm transition-all duration-300 hover:border-[var(--fd-accent)] group"
            >
              {/* Top Row: Client Monogram Avatar + Entity Pill */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl border bg-gradient-to-br font-mono text-sm font-bold tracking-wider shadow-inner ${t.initialsGradient}`}
                    >
                      {t.initials}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--fd-text-primary)] flex items-center gap-1.5">
                        <span>{t.name}</span>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--fd-status-done)]" aria-label="Verified Client" />
                      </h3>
                      <p className="text-xs text-[var(--fd-text-secondary)]">
                        {t.designation} Â· <strong className="font-semibold text-[var(--fd-text-primary)]">{t.company}</strong>
                      </p>
                      <p className="text-[11px] text-[var(--fd-text-tertiary)] flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3" />
                        <span>{t.location}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 5-Star Rating */}
                <div className="mt-4 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-[var(--fd-accent)] text-[var(--fd-accent)]" />
                  ))}
                  <span className="ml-2 font-mono text-[10px] text-[var(--fd-text-tertiary)] uppercase tracking-wider">
                    {t.entityType}
                  </span>
                </div>

                {/* Quote with subtle quote icon */}
                <div className="relative mt-4">
                  <Quote className="absolute -top-2 -left-1 h-6 w-6 text-[var(--fd-border-strong)]/40 -z-0" />
                  <p className="relative z-10 text-xs sm:text-sm leading-relaxed text-[var(--fd-text-secondary)] italic line-clamp-6 sm:line-clamp-none">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
              </div>

              {/* Bottom Result Pill */}
              <div className="mt-6 pt-4 border-t border-[var(--fd-border-subtle)] flex items-center justify-between">
                <span className="text-[11px] font-mono text-[var(--fd-accent)] font-semibold flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--fd-status-done)]" />
                  {t.metricsBadge}
                </span>
                <span className="text-[10px] text-[var(--fd-text-tertiary)] font-mono">
                  Verified Portal Client
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
