import { useState } from 'react';
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  FileSpreadsheet,
  Handshake,
  Scale,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface ServiceItem {
  id: string;
  category: 'tax' | 'accounting' | 'audit' | 'advisory';
  title: string;
  badge: string;
  tagline: string;
  description: string;
  deliverables: string[];
  icon: typeof Calculator;
}

const SERVICES_CATALOGUE: ServiceItem[] = [
  {
    id: 'corp-tax',
    category: 'tax',
    title: 'Corporate Tax & GST Compliance',
    badge: 'Direct & Indirect Tax',
    tagline: 'Timely and accurate filings, legitimate input tax credit reconciliation, and diligent audit defense.',
    description:
      'We manage your end-to-end statutory tax requirements. Our tax practice performs deep GSTR-2B reconciliation before filing, optimizes quarterly advance tax instalments, and provides audited representation for departmental inquiries.',
    deliverables: [
      'Monthly GSTR-1, GSTR-3B & annual GSTR-9/9C filings',
      'Continuous GSTR-2B ITC reconciliation to prevent credit reversals',
      'Quarterly Advance Tax projections under Sec 208/211',
      'Corporate ITR-6 & Partnership ITR-5 tax computation',
    ],
    icon: Calculator,
  },
  {
    id: 'corp-advisory',
    category: 'advisory',
    title: 'Corporate Financial Structuring & M&A Advisory',
    badge: 'Strategic Advisory',
    tagline: 'Capital structuring, equity reorganizations, and transaction due diligence.',
    description:
      'We provide strategic financial advisory for corporate reorganizations, mergers, acquisitions, and multi-entity group structuring. We help business owners protect value, optimize tax liabilities, and ensure seamless transaction closings.',
    deliverables: [
      'Corporate reorganization & holding company financial structuring',
      'Financial due diligence, business valuation & deal structuring',
      'Inter-company agreements & transfer pricing documentation',
      'Capital restructuring and promoter equity advisory',
    ],
    icon: Handshake,
  },
  {
    id: 'cloud-accounting',
    category: 'accounting',
    title: 'Full-Stack Cloud Bookkeeping & MIS',
    badge: 'Day-to-Day Operations',
    tagline: 'Clean, audit-ready books and monthly executive MIS reporting packs.',
    description:
      'Replace messy spreadsheets with daily cloud ledger maintenance. Our accountants process vendor bills, reconcile bank feeds, track receivables, and furnish monthly management information system (MIS) decks for your executive board.',
    deliverables: [
      'Multi-currency ledger entries and automated bank reconciliation',
      'Accounts payable (AP) & receivable (AR) aging schedules',
      'Monthly P&L, Balance Sheet, and Cash Flow MIS reporting packs',
      'Payroll accounting, PF, ESI, and Professional Tax settlement',
    ],
    icon: FileSpreadsheet,
  },
  {
    id: 'audit-assurance',
    category: 'audit',
    title: 'Statutory Audit & Assurance',
    badge: 'Institutional Governance',
    tagline: 'Independent audit scrutiny upholding the highest standards of financial integrity.',
    description:
      'Our assurance practice provides rigorous, unbiased statutory audits compliant with ICAI Standards on Auditing (SAs) and the Companies Act 2013, ensuring your financial statements give a true and fair view to investors and lenders.',
    deliverables: [
      'Statutory audits for Private Limited, Public & Section 8 entities',
      'Tax Audits under Section 44AB with Form 3CA/3CB-3CD Annexures',
      'Internal Financial Controls (IFC) testing & risk assessment',
      'Statutory net worth & working capital certifications',
    ],
    icon: Scale,
  },
  {
    id: 'virtual-cfo',
    category: 'advisory',
    title: 'Virtual CFO & Strategic Finance',
    badge: 'Executive Advisory',
    tagline: 'Senior financial leadership without the cost of a full-time CFO.',
    description:
      'For ambitious founders and mid-market enterprises looking to scale. We partner directly with executive leadership to model runway, prepare investor data rooms, streamline unit economics, and manage institutional banking relationships.',
    deliverables: [
      '12-month rolling cash flow modeling & burn rate management',
      'Board meeting financial decks & investor quarterly updates',
      'Unit economics, gross margin, and working capital optimization',
      'Fundraising preparation & investor financial due diligence support',
    ],
    icon: TrendingUp,
  },
  {
    id: 'roc-mca',
    category: 'accounting',
    title: 'Corporate Secretarial & ROC/MCA Compliance',
    badge: 'Corporate Governance',
    tagline: 'Full statutory compliance under the Ministry of Corporate Affairs.',
    description:
      'Protect your directors from disqualifications and statutory fines. We handle entity incorporations, annual e-Form filings, board resolutions, statutory registers, and secretarial certifications under the Companies Act 2013.',
    deliverables: [
      'Annual e-Form AOC-4 (Financials) and MGT-7 (Annual Return) filing',
      'Director KYC (DIR-3 KYC) and appointment/resignation filings',
      'Drafting board resolutions, AGM notices & statutory registers',
      'MSME-1, DPT-3 loan disclosures & beneficial ownership compliance',
    ],
    icon: ShieldCheck,
  },
];

export function ServicesSection() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'tax' | 'advisory' | 'accounting' | 'audit'>('all');

  const filteredServices = SERVICES_CATALOGUE.filter(
    (item) => activeFilter === 'all' || item.category === activeFilter,
  );

  return (
    <section id="services" className="scroll-mt-20 py-16 lg:py-24 border-t border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fd-accent-subtle-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--fd-accent)] uppercase tracking-wider">
            Comprehensive Practice Areas
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--fd-text-primary)] sm:text-4xl">
            Strategic Financial Solutions Tailored to Your Business
          </h2>
          <p className="mt-3 text-base text-[var(--fd-text-secondary)]">
            We combine rigorous statutory accounting expertise with commercial advisory. Whether you are scaling an operating
            company or structuring a multi-entity corporate group, we manage your finances with uncompromising integrity.
          </p>

          {/* Filter Tabs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {[
              { id: 'all', label: 'All Practice Areas' },
              { id: 'tax', label: 'Corporate Tax & GST' },
              { id: 'advisory', label: 'Corporate & CFO Advisory' },
              { id: 'accounting', label: 'Bookkeeping & ROC' },
              { id: 'audit', label: 'Statutory Audit' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as typeof activeFilter)}
                className={`rounded-lg px-3.5 py-1.5 text-[11px] sm:text-xs font-medium transition-colors ${
                  activeFilter === tab.id
                    ? 'bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)] shadow-xs'
                    : 'bg-[var(--fd-surface-2)] text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Services Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredServices.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                className="flex flex-col justify-between rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-bg)] p-6 sm:p-7 shadow-xs transition-all duration-200 hover:border-[var(--fd-accent)] hover:shadow-md group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--fd-accent)]/10 text-[var(--fd-accent)] group-hover:bg-[var(--fd-accent)] group-hover:text-[var(--fd-accent-contrast)] transition-colors duration-200">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="rounded-full border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--fd-accent)] truncate max-w-[140px] sm:max-w-none">
                      {service.badge}
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-bold text-[var(--fd-text-primary)] group-hover:text-[var(--fd-accent)] transition-colors">
                    {service.title}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-[var(--fd-text-secondary)]">
                    {service.tagline}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-[var(--fd-text-tertiary)]">
                    {service.description}
                  </p>

                  <div className="mt-5 border-t border-[var(--fd-border-subtle)] pt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fd-text-secondary)] mb-2">
                      Key Deliverables:
                    </div>
                    <ul className="space-y-2 text-xs text-[var(--fd-text-secondary)]">
                      {service.deliverables.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--fd-status-done)] shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--fd-border-subtle)]">
                  <a
                    href="#consultation"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--fd-accent)] hover:text-[var(--fd-accent-hover)] transition-colors"
                  >
                    <span>Inquire About This Service</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
