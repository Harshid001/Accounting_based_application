import { ShieldCheck } from 'lucide-react';

// High-fidelity certification badge graphics
function Aes256Badge() {
  return (
    <svg className="h-12 w-12 shrink-0" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="AES-256-GCM Military Grade Encryption Badge">
      <rect width="48" height="48" rx="10" fill="#171717" stroke="#262626" strokeWidth="1.5" />
      <path d="M24 8L36 13.5V23C36 30.5 30.9 37.4 24 39.5C17.1 37.4 12 30.5 12 23V13.5L24 8Z" fill="url(#aes-grad)" fillOpacity="0.15" stroke="url(#aes-grad)" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M24 16C21.8 16 20 17.8 20 20V23H28V20C28 17.8 26.2 16 24 16Z" stroke="#FF8A1F" strokeWidth="1.5" />
      <rect x="18" y="22" width="12" height="9" rx="2" fill="#331700" stroke="#FFB15C" strokeWidth="1.5" />
      <circle cx="24" cy="26" r="1.5" fill="#FF8A1F" />
      <path d="M24 27.5V29" stroke="#FF8A1F" strokeWidth="1.5" strokeLinecap="round" />
      <text x="24" y="36.5" textAnchor="middle" fill="#FFB15C" fontSize="5.5" fontWeight="800" fontFamily="monospace" letterSpacing="0.5">AES-256</text>
      <defs>
        <linearGradient id="aes-grad" x1="12" y1="8" x2="36" y2="39.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8A1F" />
          <stop offset="1" stopColor="#FF6A00" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function EphemeralTokenBadge() {
  return (
    <svg className="h-12 w-12 shrink-0" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Cryptographically Signed Ephemeral Token Badge">
      <rect width="48" height="48" rx="10" fill="#171717" stroke="#262626" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="14" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3 2" />
      <path d="M24 14V24L30 27" stroke="#34D399" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="24" r="3" fill="#10B981" fillOpacity="0.25" stroke="#34D399" strokeWidth="1.5" />
      <path d="M16 12L13 15M32 12L35 15" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" />
      <text x="24" y="42" textAnchor="middle" fill="#34D399" fontSize="5" fontWeight="700" fontFamily="monospace" letterSpacing="0.5">TLS-SIGNED</text>
    </svg>
  );
}

function IcaiEthicsBadge() {
  return (
    <svg className="h-12 w-12 shrink-0" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Official ICAI Professional Ethics & Standards Mark">
      <rect width="48" height="48" rx="10" fill="#171717" stroke="#262626" strokeWidth="1.5" />
      {/* ICAI CA Emblem Circle */}
      <circle cx="24" cy="22" r="13" fill="#331700" fillOpacity="0.4" stroke="#FF6A00" strokeWidth="1.5" />
      <circle cx="24" cy="22" r="10.5" stroke="#FFB15C" strokeWidth="0.75" strokeDasharray="1.5 1.5" />
      {/* Distinctive stylized CA letters */}
      <path d="M21 17C18.8 17 17.5 19 17.5 22C17.5 25 18.8 27 21 27C22.2 27 23.2 26.3 23.8 25.2" stroke="#FFB15C" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M25 27L28 17L31 27M26 24.5H30" stroke="#FFB15C" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <text x="24" y="41.5" textAnchor="middle" fill="#FFB15C" fontSize="5.5" fontWeight="800" fontFamily="sans-serif" letterSpacing="0.8">ICAI · CA</text>
    </svg>
  );
}

function AuditTrailBadge() {
  return (
    <svg className="h-12 w-12 shrink-0" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Tamper-Evident Access Audit Trail Compliance Mark">
      <rect width="48" height="48" rx="10" fill="#171717" stroke="#262626" strokeWidth="1.5" />
      <path d="M14 12H34V36H14V12Z" rx="2" stroke="#FF8A1F" strokeWidth="1.5" />
      <path d="M18 18H30M18 23H27M18 28H24" stroke="#FF8A1F" strokeWidth="1.5" strokeLinecap="round" />
      {/* Verification Stamp Check */}
      <circle cx="31" cy="30" r="6" fill="#8C3D00" stroke="#FF8A1F" strokeWidth="1.5" />
      <path d="M28.5 30L30.5 32L34 28" stroke="#F5F2ED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="24" y="42" textAnchor="middle" fill="#FF8A1F" fontSize="5" fontWeight="700" fontFamily="monospace" letterSpacing="0.5">DPDP · ISO</text>
    </svg>
  );
}

export function SecurityTrustSection() {
  const securityFeatures = [
    {
      badge: <Aes256Badge />,
      tag: 'MILITARY GRADE CIPHER',
      title: 'AES-256-GCM Encrypted Vaults',
      description:
        'Sensitive financial statements, salary registers, Aadhaar, and PAN identifiers are encrypted at rest using authenticated Galois/Counter Mode encryption, preventing unauthorized access.',
    },
    {
      badge: <EphemeralTokenBadge />,
      tag: 'ZERO OPEN EMAIL RISK',
      title: 'Ephemeral Signed Transfer Tokens',
      description:
        'Stop sending confidential balance sheets over open emails or WhatsApp. Files upload directly through short-lived, cryptographically signed tokens into private, isolated cloud storage.',
    },
    {
      badge: <IcaiEthicsBadge />,
      tag: 'STATUTORY CODE OF ETHICS',
      title: 'Strict NDA & ICAI Professional Ethics',
      description:
        'Every client relationship is bound by institutional Non-Disclosure Agreements and the statutory Code of Ethics governed by the Institute of Chartered Accountants of India.',
    },
    {
      badge: <AuditTrailBadge />,
      tag: 'TAMPER-EVIDENT LOGS',
      title: 'Immutable Access Audit Trails',
      description:
        'Every document view, tax calculation modification, and government submission is permanently logged with timestamps and user identifiers for corporate governance compliance.',
    },
  ];

  return (
    <section id="security" className="scroll-mt-20 py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-md bg-[var(--fd-accent)]/12 px-3 py-1 text-xs font-semibold text-[var(--fd-accent)] uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>JV Tax Consultancy Vault Architecture</span>
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--fd-text-primary)] sm:text-4xl">
            Confidential & Secure Infrastructure for Your Financial Records
          </h2>
          <p className="mt-3 text-base text-[var(--fd-text-secondary)]">
            Tax documents, cap tables, salary sheets, and corporate financial records demand the highest standard of technical
            and legal safeguards. We protect your business confidentiality with institutional rigor.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {securityFeatures.map((feat, idx) => (
            <div
              key={idx}
              className="group rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-6 shadow-xs transition-all duration-300 hover:border-[var(--fd-accent)] hover:-translate-y-1 hover:shadow-[0_16px_40px_-16px_rgba(255,106,0,0.18)] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  {feat.badge}
                  <span className="rounded-md border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-2.5 py-1 font-mono text-[10px] font-semibold text-[var(--fd-accent)]">
                    {feat.tag}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[var(--fd-text-primary)]">
                  {feat.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--fd-text-secondary)]">
                  {feat.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Reassurance Bar */}
        <div className="mt-10 rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[var(--fd-text-secondary)]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>
              <strong>ICAI Ethics & Professional Standards: </strong>
              All client data resides in secure, isolated environments with zero third-party data commercialization.
            </span>
          </div>
          <a
            href="#consultation"
            className="font-bold text-[var(--fd-accent)] hover:text-[var(--fd-accent-hover)] shrink-0"
          >
            Discuss Client Confidentiality With Our Team →
          </a>
        </div>
      </div>
    </section>
  );
}
