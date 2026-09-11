import { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck,
  Scale,
} from 'lucide-react';

interface EntityRoadmap {
  title: string;
  badge: string;
  description: string;
  monthly: string[];
  quarterly: string[];
  annual: string[];
  entitySpecific: string[];
  riskSaved: string;
}

type EntityKey = 'pvt_ltd' | 'llp' | 'corporate_group' | 'partnership' | 'proprietorship';

const ENTITY_ROADMAPS: Record<EntityKey, EntityRoadmap> = {
  corporate_group: {
    title: 'Corporate Group & Multi-Entity Structure',
    badge: 'Companies Act 2013 + Intercompany + Transfer Pricing',
    description:
      'Multi-entity holding and operating structures requiring consolidated financial reporting, inter-company transfer pricing, related-party transaction disclosures, and group tax optimization.',
    monthly: ['Consolidated GSTR-1 Invoicing (11th)', 'GSTR-3B Tax Netting & Input Credit (20th)', 'Intercompany Billing & TDS Deductions (Sec 194C/J)'],
    quarterly: ['Group Profit & Loss Consolidation Review', 'Advance Tax Estimation on Group Profits', 'Form 26Q Vendor TDS across Entities'],
    annual: ['Consolidated Statutory Financial Statements', 'ITR-6 Corporate Income Tax Filings', 'Inter-Company Transfer Pricing Form 3CEB Certification'],
    entitySpecific: [
      'Inter-company balances & transaction matching',
      'Consolidated group MIS & board reporting pack',
      'Related-party disclosures under AS-18 / Ind AS 24',
      'Sub-contractor & vendor GST withholding verification',
    ],
    riskSaved: 'Protects against transfer pricing penalties, inter-company tax leakages, and non-compliance across group entities.',
  },
  pvt_ltd: {
    title: 'Private Limited Company (Pvt Ltd)',
    badge: 'Companies Act 2013 + GST + Income Tax',
    description:
      'High statutory rigor requiring independent statutory audit, Ministry of Corporate Affairs filings, monthly GST reconciliation, and quarterly advance tax.',
    monthly: ['GSTR-1 (11th) Outward Invoicing', 'GSTR-3B (20th) Tax Settlement & 2B Matching', 'PF, ESI & Professional Tax Challans (15th)'],
    quarterly: ['TDS Form 24Q (Salary) & 26Q (Vendor) (31st)', 'Advance Tax Instalments (15 Jun, 15 Sep, 15 Dec, 15 Mar)'],
    annual: ['Tax Audit Report Form 3CA-3CD (30 Sep)', 'ITR-6 Corporate Income Tax Return (31 Oct)', 'GSTR-9 & 9C Annual Reconciliation (31 Dec)'],
    entitySpecific: [
      'e-Form AOC-4 Financial Statements (30 days from AGM)',
      'e-Form MGT-7 Annual Return (60 days from AGM)',
      'DIR-3 KYC for all active Company Directors (30 Sep)',
      'Form MSME-1 & DPT-3 Annual Disclosures',
    ],
    riskSaved: 'Protects against cumulative statutory late fees, penal interest, and director disqualifications under the Companies Act.',
  },
  llp: {
    title: 'Limited Liability Partnership (LLP)',
    badge: 'LLP Act 2008 + Tax Laws',
    description:
      'Combines corporate protection with tax pass-through efficiency. Demands annual ROC statement of accounts, solvency filings, and partnership tax returns.',
    monthly: ['GSTR-1 Outward Return', 'GSTR-3B Tax Payment & Input Verification'],
    quarterly: ['TDS Returns (26Q / 24Q)', 'Quarterly Advance Tax Payments'],
    annual: ['Tax Audit u/s 44AB (if turnover > limits)', 'ITR-5 Partnership Return (31 Jul / 31 Oct)', 'GSTR-9 Annual Return'],
    entitySpecific: [
      'Form 11 Annual Return of LLP (30 May)',
      'Form 8 Statement of Account & Solvency (30 Oct)',
      'Designated Partner KYC Verification',
      'Partner Capital Ledger Reconciliation',
    ],
    riskSaved: 'Mitigates compounding statutory late fees under the LLP Act (which accumulate on a daily basis indefinitely).',
  },
  partnership: {
    title: 'Partnership Firm (Registered / Unregistered)',
    badge: 'Indian Partnership Act + Income Tax Act',
    description:
      'Focuses on partner remuneration limits under Section 40(b), GST compliance, capital account tracking, and audited financials.',
    monthly: ['GSTR-1 Outward Register', 'GSTR-3B Tax Settlement'],
    quarterly: ['TDS Returns on Contractor & Rent Payments', 'Advance Tax Q1 to Q4'],
    annual: ['Tax Audit u/s 44AB (if applicable)', 'ITR-5 Partnership Tax Return', 'Partner Capital Account Reconciliation'],
    entitySpecific: [
      'Sec 40(b) Partner Remuneration & Interest Verification',
      'Form 3CD Partner Transaction Disclosures',
      'Partnership Deed Amendment Certifications',
    ],
    riskSaved: 'Prevents disallowance of partner salary and interest deductions during scrutiny assessments.',
  },
  proprietorship: {
    title: 'Sole Proprietorship & MSME Trader',
    badge: 'Micro & Small Business (MSME)',
    description:
      'Streamlined compliance focused on GST monthly/QRMP returns, presumptive taxation (Sec 44AD/44ADA), and personal ITR filings.',
    monthly: ['GSTR-1 / IFF Invoice Upload', 'GSTR-3B Tax Payment & ITC Claim'],
    quarterly: ['TDS on high-value payments (Sec 194-IB/194M)', 'Advance Tax (Single instalment on 15 Mar if 44AD)'],
    annual: ['ITR-3 / ITR-4 Presumptive Return (31 Jul or 31 Oct)', 'GSTR-9 Annual Return (if turnover > â‚¹2 Cr)'],
    entitySpecific: [
      'Bank statement reconciliation separating business from personal transactions',
      'Presumptive 6%/8%/50% profit computation under Sec 44AD/44ADA',
      'MSME Udyam Registration compliance & benefits',
    ],
    riskSaved: 'Facilitates timely ITR filing to enable carry-forward of business losses and avoid late fees u/s 234F.',
  },
};

export function EntityRoadmapWidget() {
  const [selectedEntity, setSelectedEntity] = useState<EntityKey>('pvt_ltd');
  const data = ENTITY_ROADMAPS[selectedEntity];

  return (
    <section id="entity-roadmap" className="scroll-mt-20 py-16 lg:py-24 border-t border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fd-status-progress)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--fd-status-progress)] uppercase tracking-wider">
            Tailored Statutory Coverage
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--fd-text-primary)] sm:text-4xl">
            Custom Statutory Roadmap for Your Entity Structure
          </h2>
          <p className="mt-3 text-base text-[var(--fd-text-secondary)]">
            Every legal entity has unique compliance obligations. Select your structure below to explore the exact
            filing calendar, regulatory milestones, and risk safeguards our practice manages for your organization.
          </p>

          {/* Entity Selector Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {(
              [
                { id: 'pvt_ltd', label: 'Private Limited Company' },
                { id: 'llp', label: 'Limited Liability Partnership' },
                { id: 'corporate_group', label: 'Corporate Group / Holding' },
                { id: 'partnership', label: 'Partnership Firm' },
                { id: 'proprietorship', label: 'Sole Proprietor / MSME' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setSelectedEntity(btn.id)}
                className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all ${
                  selectedEntity === btn.id
                    ? 'bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)] shadow-xs'
                    : 'bg-[var(--fd-surface-2)] text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)]'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Roadmap Display Card */}
        <div className="mt-10 rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-bg)] p-6 sm:p-8 shadow-sm">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--fd-border-subtle)] pb-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold text-[var(--fd-text-primary)]">{data.title}</h3>
                <span className="rounded bg-[var(--fd-accent-subtle-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--fd-accent)]">
                  {data.badge}
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[var(--fd-text-secondary)]">{data.description}</p>
            </div>
            <div className="shrink-0 rounded-lg bg-[var(--fd-status-done)]/10 border border-[var(--fd-status-done)]/20 px-3 py-1.5 text-xs text-[var(--fd-status-done)] font-semibold">
              Full Financial Year Coverage
            </div>
          </div>

          {/* 4-Column Milestones */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Monthly */}
            <div className="rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--fd-text-primary)]">
                <Clock className="h-4 w-4 text-[var(--fd-accent)]" />
                <span>Monthly Recurring</span>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-[var(--fd-text-secondary)]">
                {data.monthly.map((m, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[var(--fd-accent)] font-bold">Â·</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quarterly */}
            <div className="rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--fd-text-primary)]">
                <Calendar className="h-4 w-4 text-[var(--fd-status-progress)]" />
                <span>Quarterly Cycles</span>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-[var(--fd-text-secondary)]">
                {data.quarterly.map((q, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[var(--fd-status-progress)] font-bold">Â·</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Annual */}
            <div className="rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--fd-text-primary)]">
                <FileCheck className="h-4 w-4 text-[var(--fd-accent)]" />
                <span>Annual Audits & ITR</span>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-[var(--fd-text-secondary)]">
                {data.annual.map((a, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[var(--fd-accent)] font-bold">Â·</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Entity Specific */}
            <div className="rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--fd-text-primary)]">
                <Scale className="h-4 w-4 text-[#FFB15C]" />
                <span>Statutory Governance</span>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-[var(--fd-text-secondary)]">
                {data.entitySpecific.map((e, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#FFB15C] font-bold">Â·</span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Risk Saved Banner */}
          <div className="mt-6 flex items-center justify-between flex-wrap gap-3 rounded-xl border border-[var(--fd-status-done)]/20 bg-[var(--fd-status-done)]/10 p-4 text-xs text-[var(--fd-status-done)]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                <strong>Your Financial Protection: </strong>
                {data.riskSaved}
              </span>
            </div>
            <a
              href="#consultation"
              className="inline-flex items-center font-bold underline underline-offset-2 hover:text-[#6EE7B7]"
            >
              Get compliant roadmap for your entity â†’
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
