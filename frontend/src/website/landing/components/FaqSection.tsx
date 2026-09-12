import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How quickly can our company transition its accounting and tax filings to your firm?',
    answer:
      'Most business transitions take fewer than 5 business days. Our team coordinates directly with your outgoing accountants or internal bookkeepers to migrate opening balances, verify prior period returns (GST, TDS, ITR), and immediately load your legal deadlines into your dedicated 120-day statutory calendar.',
  },
  {
    question: 'How does JV Tax Consultancy handle multi-entity and corporate group accounting?',
    answer:
      'We act as independent financial controllers and advisors for multi-entity corporate structures, holding companies, and operating subsidiaries. We consolidate group accounts, manage inter-company reconciliations, ensure transfer pricing compliance, and furnish executive-level financial reporting across all your entities.',
  },
  {
    question: 'What visibility does our internal leadership team receive through the Client Portal?',
    answer:
      'Every client receives secure access to our 24/7 Client Portal. Your founders, CFO, and accounts team can monitor live statutory filing statuses, download official government receipts (ARN acknowledgements and tax challans) with 1 click, and upload required documents into securely encrypted vaults.',
  },
  {
    question: 'Can we engage your firm for Virtual CFO services while keeping our internal accountant?',
    answer:
      'Yes, absolutely. In our Virtual CFO engagements, we work alongside your existing in-house bookkeeper. We oversee monthly book closings, build 12-month rolling cash flow forecasts, optimize unit economics, and prepare investor and board reporting packs, elevating your internal team’s output.',
  },
  {
    question: 'How does your practice safeguard clients against late-filing penalties on statutory returns?',
    answer:
      'We never wait until the 11th hour. Our practice tracks statutory milestones across a 120-day horizon, initiating reconciliations and document collection weeks ahead of government cutoffs. Every tax computation undergoes dual-tier verification by a qualified Senior Chartered Accountant prior to government submission.',
  },
  {
    question: 'How are sensitive corporate records, PAN, and bank statements protected?',
    answer:
      'Confidential records are encrypted at rest using AES-256-GCM. Uploads occur through temporary, cryptographically signed tokens directly into private storage, eliminating unencrypted email attachments. Furthermore, all client partnerships are legally bound by institutional Non-Disclosure Agreements (NDAs).',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="scroll-mt-20 py-16 lg:py-24 border-t border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)]">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fd-accent-subtle-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--fd-accent)] uppercase tracking-wider">
            Client Inquiries & Answers
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--fd-text-primary)] sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-base text-[var(--fd-text-secondary)]">
            Answers to common questions about engaging our practice, transitioning your books, and our digital client experience.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-[var(--fd-border)] bg-[var(--fd-bg)] overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="flex w-full items-center justify-between p-5 text-left text-sm sm:text-base font-semibold text-[var(--fd-text-primary)] hover:text-[var(--fd-accent)] focus-visible:outline-2 focus-visible:outline-[var(--fd-focus-ring)]"
                  aria-expanded={isOpen}
                >
                  <span className="pr-4">{item.question}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[var(--fd-text-secondary)] transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[var(--fd-accent)]' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--fd-border-subtle)] px-5 pb-5 pt-3 text-xs sm:text-sm text-[var(--fd-text-secondary)] leading-relaxed animate-in fade-in duration-150">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still have questions banner */}
        <div className="mt-10 rounded-xl bg-[var(--fd-surface-2)] p-6 text-center border border-[var(--fd-border-subtle)]">
          <h3 className="text-sm font-bold text-[var(--fd-text-primary)]">
            Have a specific scenario or complex corporate structure?
          </h3>
          <p className="mt-1 text-xs text-[var(--fd-text-secondary)]">
            Our Senior Partners are available for a confidential review of your entity&apos;s financial framework.
          </p>
          <div className="mt-4">
            <a
              href="#consultation"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fd-accent)] px-4 py-2 text-xs font-semibold text-[var(--fd-accent-contrast)] hover:bg-[var(--fd-accent-hover)] transition-colors"
            >
              <span>Schedule Direct Partner Discussion</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
