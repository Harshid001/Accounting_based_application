import { Link } from 'react-router-dom';
import {
  Award,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Phone,
  Scale,
  ShieldCheck,
} from 'lucide-react';

import { usePageTitle } from '@/hooks/usePageTitle';
import { RouteAnnouncer, SkipLink } from '@/components/domain/SkipLink';
import { Button } from '@/components/ui/button';
import { JVLogoMark } from '@/components/brand/JVLogo';
import { LandingNavbar } from './components/LandingNavbar';
import { LandingFooter } from './components/LandingFooter';

interface Partner {
  id: string;
  name: string;
  designation: string;
  cadre: string;
  icaiNumber: string;
  membershipType: 'Fellow Member (FCA)' | 'Associate Member (ACA)';
  qualifications: string;
  experience: string;
  specializations: string[];
  initials: string;
  accentColor: string;
  bio: string;
  focusArea: string;
}

export function TeamPage() {
  usePageTitle('Partners & Chartered Advisory Leadership | JV Tax Consultancy');

  const partners: Partner[] = [
    {
      id: 'jignesh-patel',
      name: 'CA Jignesh V. Patel',
      designation: 'Senior Managing Partner',
      cadre: 'Practice Head & Founder',
      icaiNumber: 'M.No. 054219',
      membershipType: 'Fellow Member (FCA)',
      qualifications: 'B.Com, FCA, DISA (ICAI)',
      experience: '18+ Years Experience',
      initials: 'JP',
      accentColor: 'from-indigo-500/25 via-purple-500/20 to-blue-500/25 border-indigo-500/40 text-indigo-300',
      focusArea: 'Corporate Tax Jurisprudence & Appellate Advisory',
      specializations: [
        'Direct Tax Litigation & ITAT Appeals',
        'Corporate Tax Planning & Group Restructuring',
        'Mergers, De-mergers & ROC Due Diligence',
        'HNI & Director Tax Planning',
      ],
      bio: 'Leads practice strategy and high-stakes corporate tax structuring. With over 18 years post-qualification experience, he regularly advises boardrooms on complex tax optimizations, corporate restructuring, and appellate matters.',
    },
    {
      id: 'priyanshu-sharma',
      name: 'CA Priyanshu Sharma',
      designation: 'Partner — Direct Tax & Corporate Advisory',
      cadre: 'Senior Partner',
      icaiNumber: 'M.No. 089421',
      membershipType: 'Fellow Member (FCA)',
      qualifications: 'B.Com, FCA, Insolvency Professional',
      experience: '14+ Years Experience',
      initials: 'PS',
      accentColor: 'from-sky-500/25 via-indigo-500/20 to-blue-500/25 border-sky-500/40 text-sky-300',
      focusArea: 'Corporate Tax Planning & Financial Controllership',
      specializations: [
        'Corporate Financial Systems & Advisory',
        'Section 194C / 194J TDS Architecture',
        'Capital Restructuring & MIS Architecture',
        'Private Equity Financial Data Rooms',
      ],
      bio: 'Specializes in corporate tax strategy, statutory deductions, and commercial finance. He is known for establishing watertight financial systems and mitigating tax leakages before audit closings.',
    },
    {
      id: 'ananya-desai',
      name: 'CA Ananya Desai',
      designation: 'Partner — Assurance & Regulatory Audit',
      cadre: 'Senior Partner',
      icaiNumber: 'M.No. 112845',
      membershipType: 'Fellow Member (FCA)',
      qualifications: 'M.Com, FCA, Certified Forensic Auditor (FAFD)',
      experience: '13+ Years Experience',
      initials: 'AD',
      accentColor: 'from-purple-500/25 via-pink-500/20 to-indigo-500/25 border-purple-500/40 text-purple-300',
      focusArea: 'Statutory Audit u/s 44AB & Internal Financial Controls (IFC)',
      specializations: [
        'Statutory Audit compliant with ICAI SAs',
        'Internal Financial Controls (IFC) Testing',
        'Banking Working Capital Audits',
        'Forensic Accounting & Scrutiny Proofing',
      ],
      bio: 'Heads the firm’s assurance and regulatory compliance desk. She oversees independent statutory audits for manufacturing, pharma, and agro enterprises, ensuring adherence to Standards on Auditing (SAs) issued by the ICAI.',
    },
    {
      id: 'bhavesh-mehta',
      name: 'CA Bhavesh Mehta',
      designation: 'Partner — Indirect Tax (GST) & Corporate Advisory',
      cadre: 'Partner',
      icaiNumber: 'M.No. 147890',
      membershipType: 'Associate Member (ACA)',
      qualifications: 'B.Com, ACA, Certificate in GST (ICAI)',
      experience: '9+ Years Experience',
      initials: 'BM',
      accentColor: 'from-emerald-500/25 via-teal-500/20 to-sky-500/25 border-emerald-500/40 text-emerald-300',
      focusArea: 'GST Litigation, GSTR-9/9C Audit & Virtual CFO Retainers',
      specializations: [
        'GST Audit & Input Tax Credit (ITC) Defense',
        'Virtual CFO for Mid-Market Enterprises',
        'Cash Flow & Rolling Runway Forecasting',
        'MSME & Startup Financial Governance',
      ],
      bio: 'Directs the Indirect Tax and Virtual CFO division. His team has successfully defended over 400+ GST audit reconciliations and manages real-time compliance operations for rapidly scaling businesses across Gujarat.',
    },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--fd-bg)] text-[var(--fd-text-primary)] page-transition">
      <SkipLink />
      <LandingNavbar />

      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {/* Team Hero Header */}
        <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)]">
          <div
            className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-[var(--fd-accent)]/15 via-indigo-500/10 to-sky-500/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              {/* Breadcrumb Pill */}
              <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--fd-border)] bg-[var(--fd-surface-2)]/80 px-4 py-1.5 text-xs font-medium text-[var(--fd-text-primary)] shadow-sm backdrop-blur-sm">
                <JVLogoMark size={20} badge />
                <span className="font-bold uppercase tracking-wider text-[11px]">JV Tax Consultancy</span>
                <ChevronRight className="h-3 w-3 text-[var(--fd-text-tertiary)]" />
                <span className="text-[var(--fd-accent)]">Practice Partners</span>
              </div>

              <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-[var(--fd-text-primary)] sm:text-5xl lg:text-5xl sm:leading-[1.15]">
                Chartered Accountants & Leadership Partners
              </h1>

              <p className="mt-5 text-base sm:text-lg leading-relaxed text-[var(--fd-text-secondary)]">
                Our practice is led by senior Fellow Chartered Accountants (FCAs) governed by the Institute
                of Chartered Accountants of India. Every statutory filing, audit review, and corporate tax
                position receives direct scrutiny from experienced partners.
              </p>

              {/* ICAI Standards Trust Badge */}
              <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-4 rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-2)] px-4 py-2 text-xs font-mono text-[var(--fd-text-secondary)]">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  ICAI Code of Ethics Compliant
                </span>
                <span className="hidden sm:inline text-[var(--fd-border)]">|</span>
                <span className="flex items-center gap-1.5 text-[var(--fd-accent)]">
                  <ShieldCheck className="h-4 w-4" />
                  Patan Practice Headquarters (Krushnam Plaza)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Partners Grid */}
        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className="rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-6 sm:p-8 shadow-sm transition-all duration-300 hover:border-[var(--fd-accent)] flex flex-col justify-between group"
                >
                  <div>
                    {/* Top Credential Crest Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[var(--fd-border-subtle)]">
                      <div className="flex items-center gap-4">
                        {/* Institutional Credential Seal */}
                        <div
                          className={`relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl border bg-gradient-to-br shadow-inner ${partner.accentColor}`}
                        >
                          <span className="font-mono text-xl sm:text-2xl font-black tracking-wider">
                            {partner.initials}
                          </span>
                          <span className="absolute -bottom-1.5 -right-1.5 rounded-full border border-[var(--fd-border)] bg-[var(--fd-surface-2)] p-1 text-emerald-400 shadow-xs">
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </span>
                        </div>

                        <div>
                          <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fd-surface-2)] px-2 py-0.5 text-[11px] font-mono font-semibold text-[var(--fd-accent)] border border-[var(--fd-border-subtle)]">
                            <span>{partner.membershipType}</span>
                          </div>
                          <h2 className="mt-1 text-lg sm:text-xl font-bold text-[var(--fd-text-primary)]">
                            {partner.name}
                          </h2>
                          <p className="text-xs font-semibold text-[var(--fd-text-secondary)]">
                            {partner.designation}
                          </p>
                        </div>
                      </div>

                      {/* ICAI Reg Badge */}
                      <div className="sm:text-right mt-2 sm:mt-0">
                        <span className="block font-mono text-xs font-bold text-[var(--fd-accent)]">
                          {partner.icaiNumber}
                        </span>
                        <span className="text-[10px] text-[var(--fd-text-tertiary)] uppercase tracking-wider block mt-0.5">
                          ICAI Registered
                        </span>
                      </div>
                    </div>

                    {/* Qualifications & Experience Row */}
                    <div className="grid grid-cols-2 gap-3 py-4 text-xs border-b border-[var(--fd-border-subtle)]">
                      <div className="flex items-center gap-2 text-[var(--fd-text-secondary)]">
                        <GraduationCap className="h-4 w-4 text-[var(--fd-accent)] shrink-0" />
                        <span>{partner.qualifications}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--fd-text-secondary)]">
                        <Award className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>{partner.experience}</span>
                      </div>
                    </div>

                    {/* Bio */}
                    <p className="mt-4 text-xs sm:text-sm leading-relaxed text-[var(--fd-text-secondary)]">
                      {partner.bio}
                    </p>

                    {/* Key Specializations */}
                    <div className="mt-5">
                      <h3 className="text-xs font-bold text-[var(--fd-text-primary)] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <Scale className="h-3.5 w-3.5 text-[var(--fd-accent)]" />
                        <span>Core Advisory Practice Areas</span>
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {partner.specializations.map((spec, sIdx) => (
                          <span
                            key={sIdx}
                            className="rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-2.5 py-1 text-[10px] sm:text-[11px] text-[var(--fd-text-secondary)]"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Consultation Action Foot */}
                  <div className="mt-8 pt-4 border-t border-[var(--fd-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-[11px] text-[var(--fd-text-tertiary)] flex items-center gap-1.5 font-mono">
                      <Building2 className="h-3.5 w-3.5 text-sky-400" />
                      <span>{partner.focusArea}</span>
                    </div>

                    <Button asChild variant="secondary" size="sm" className="shadow-xs shrink-0">
                      <Link to="/#consultation" className="flex items-center gap-1.5 text-xs">
                        <CalendarCheck className="h-3.5 w-3.5 text-[var(--fd-accent)]" />
                        <span>Consult Partner</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Practice Ethics & Quality Reassurance */}
            <div className="mt-16 rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-6 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                <div className="lg:col-span-2 space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--fd-accent)] uppercase tracking-wider">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span>The ICAI Professional Benchmark</span>
                  </div>
                  <h3 className="text-lg font-bold text-[var(--fd-text-primary)]">
                    Direct Partner Accountability & Strict Non-Disclosure
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--fd-text-secondary)] leading-relaxed">
                    Unlike firms that hand off your sensitive tax computations to junior interns, our practice model
                    ensures that every filing, statutory audit certificate, and corporate tax computation is personally
                    reviewed and signed by designated Chartered Accountants.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 justify-center">
                  <Button asChild variant="primary" size="md" className="w-full justify-center shadow-md">
                    <Link to="/#consultation" className="flex items-center justify-center gap-2">
                      <CalendarCheck className="h-4 w-4" />
                      <span>Book Senior Partner Consultation</span>
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="md" className="w-full justify-center">
                    <a href="tel:+919737046913" className="flex items-center justify-center gap-2">
                      <Phone className="h-4 w-4 text-emerald-400" />
                      <span>Helpline: +91 97370 46913</span>
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
      <RouteAnnouncer />
    </div>
  );
}
