import { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from 'lucide-react';

interface ComplianceItem {
  id: string;
  name: string;
  code: string;
  category: 'gst' | 'income_tax' | 'tds' | 'mca';
  frequency: string;
  rule: string;
  checklist: string[];
  penaltyRisk: string;
}

const STATUTORY_CATALOGUE: ComplianceItem[] = [
  {
    id: 'gstr1',
    name: 'GSTR-1 Monthly Outward Return',
    code: 'GSTR-1',
    category: 'gst',
    frequency: 'Monthly (or QRMP)',
    rule: '11th of succeeding month',
    checklist: ['B2B outward tax invoices', 'Credit & debit notes register', 'Export invoices with shipping bills', 'HSN code summary reconciliation'],
    penaltyRisk: 'Late fee â‚¹50/day (â‚¹20 for nil) + blocked e-way bill generation for buyers.',
  },
  {
    id: 'gstr3b',
    name: 'GSTR-3B Summary & Tax Settlement',
    code: 'GSTR-3B',
    category: 'gst',
    frequency: 'Monthly',
    rule: '20th of succeeding month',
    checklist: ['Monthly purchase register', 'GSTR-2B ITC auto-populated comparison', 'Outward tax liability ledger', 'Bank payment challan verification'],
    penaltyRisk: '18% p.a. interest on net tax + blocked ITC claims under Section 16(4).',
  },
  {
    id: 'taxaudit',
    name: 'Tax Audit Report u/s 44AB',
    code: 'Form 3CA/3CB-3CD',
    category: 'income_tax',
    frequency: 'Annual',
    rule: '30th September of Assessment Year',
    checklist: ['Trial balance & general ledger', 'Depreciation schedules (Companies vs IT Act)', 'Related party disclosures (Sec 40A(2)(b))', 'GST vs Income Tax turnover reconciliation'],
    penaltyRisk: '0.5% of total business turnover up to â‚¹1,50,000 penalty u/s 271B.',
  },
  {
    id: 'advancetax',
    name: 'Advance Tax Instalments (Q1 to Q4)',
    code: 'Sec 208/211',
    category: 'income_tax',
    frequency: 'Quarterly',
    rule: '15 Jun (15%), 15 Sep (45%), 15 Dec (75%), 15 Mar (100%)',
    checklist: ['Estimated annual profit computation', 'TDS credit verification in Form 26AS / AIS', 'Prior instalment challan adjustment'],
    penaltyRisk: 'Mandatory compound interest @ 1% per month under Sections 234B & 234C.',
  },
  {
    id: 'tds26q',
    name: 'TDS Return (Non-Salary Vendor Payments)',
    code: 'Form 26Q',
    category: 'tds',
    frequency: 'Quarterly',
    rule: '31st of month following quarter end (31 May for Q4)',
    checklist: ['Vendor invoice register with TDS deducted', 'BSR code challans (ITNS 281)', 'PAN verification sheet', '194C / 194J / 194Q classification'],
    penaltyRisk: 'Late fee â‚¹200/day u/s 234E + discretionary penalty up to â‚¹1,00,000 u/s 271H.',
  },
  {
    id: 'aoc4',
    name: 'MCA Filing of Financial Statements',
    code: 'e-Form AOC-4 / AOC-4 XBRL',
    category: 'mca',
    frequency: 'Annual',
    rule: 'Within 30 days of Annual General Meeting (AGM)',
    checklist: ['Audited balance sheet & P&L', 'Directors report & MGT-9 extract', 'Auditors report with CARO notes', 'Notice of AGM'],
    penaltyRisk: 'â‚¹100/day continuing penalty on company and directors until rectified.',
  },
];

export function ComplianceRadarSection() {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'gst' | 'income_tax' | 'tds' | 'mca'>('all');
  const [expandedId, setExpandedId] = useState<string | null>('gstr3b');

  const filteredCatalogue = STATUTORY_CATALOGUE.filter(
    (item) => selectedCategory === 'all' || item.category === selectedCategory,
  );

  return (
    <section id="compliance-radar" className="scroll-mt-20 py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fd-status-done)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--fd-status-done)] uppercase tracking-wider">
            Proactive Statutory Radar
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--fd-text-primary)] sm:text-4xl">
            How We Protect Your Business From Costly Penalties
          </h2>
          <p className="mt-3 text-base text-[var(--fd-text-secondary)]">
            Indian corporate and tax compliance moves fast. Our practice continuously tracks statutory filing schedules,
            calculates statutory due dates under the Income Tax Act, GST Law, and Companies Act, and audits your numbers well
            before government penalty windows.
          </p>

          {/* Category Filter Tabs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {[
              { id: 'all', label: 'All Statutory Filings' },
              { id: 'gst', label: 'GST Filings (GSTR)' },
              { id: 'income_tax', label: 'Income Tax & Audit' },
              { id: 'tds', label: 'TDS / TCS Statements' },
              { id: 'mca', label: 'MCA & ROC Compliance' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id as typeof selectedCategory)}
                className={`rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                  selectedCategory === tab.id
                    ? 'bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)] shadow-xs'
                    : 'bg-[var(--fd-surface-2)] text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Compliance Cards Grid */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCatalogue.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-5 shadow-xs transition-all duration-200 hover:border-[var(--fd-accent)]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[var(--fd-accent)] bg-[var(--fd-accent-subtle-bg)] px-2 py-0.5 rounded">
                      {item.code}
                    </span>
                    <span className="text-[11px] font-medium text-[var(--fd-text-tertiary)]">
                      {item.frequency}
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-bold text-[var(--fd-text-primary)]">
                    {item.name}
                  </h3>

                  <div className="mt-3 flex items-start gap-2 text-xs text-[var(--fd-text-secondary)] bg-[var(--fd-surface-2)] p-2.5 rounded-lg">
                    <Calendar className="h-4 w-4 shrink-0 text-[var(--fd-accent)] mt-0.5" />
                    <div>
                      <span className="font-semibold text-[var(--fd-text-primary)]">Statutory Deadline: </span>
                      <span>{item.rule}</span>
                    </div>
                  </div>

                  {/* Penalty Avoided Note */}
                  <div className="mt-3 flex items-start gap-2 text-xs text-[var(--fd-status-danger)]/90 bg-[var(--fd-status-danger)]/10 border border-[var(--fd-status-danger)]/20 p-2.5 rounded-lg">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-[var(--fd-status-danger)] mt-0.5" />
                    <div>
                      <span className="font-semibold text-[var(--fd-status-danger)]">Penalty Saved: </span>
                      <span>{item.penaltyRisk}</span>
                    </div>
                  </div>

                  {/* Expandable Checklist */}
                  {isExpanded && (
                    <div className="mt-4 border-t border-[var(--fd-border-subtle)] pt-3 animate-in fade-in duration-200">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fd-text-secondary)] mb-2">
                        What We Review & Audit:
                      </div>
                      <ul className="space-y-1.5 text-xs text-[var(--fd-text-secondary)]">
                        {item.checklist.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--fd-status-done)] shrink-0 mt-0.5" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--fd-border-subtle)] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--fd-accent)] hover:text-[var(--fd-accent-hover)]"
                  >
                    <span>{isExpanded ? 'Hide Audit Checklist' : 'View Audit Checklist'}</span>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  <a
                    href="#consultation"
                    className="text-[11px] font-semibold text-[var(--fd-text-tertiary)] hover:text-[var(--fd-text-primary)] transition-colors"
                  >
                    Consult on this â†’
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
