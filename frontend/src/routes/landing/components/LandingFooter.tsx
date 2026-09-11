import { Link } from 'react-router-dom';
import { Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { JVLogo } from '@/components/brand/JVLogo';

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] text-[var(--fd-text-secondary)] text-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5" aria-label="JV Tax Consultancy Home">
              <JVLogo size="md" />
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-sm text-[var(--fd-text-primary)]">
                  JV Tax Consultancy
                </span>
                <span className="text-[10px] font-medium text-[var(--fd-text-tertiary)] tracking-wider uppercase">
                  Chartered Advisory & Audit Practice
                </span>
              </div>
            </Link>

            <p className="max-w-sm text-xs leading-relaxed text-[var(--fd-text-secondary)]">
              Strategic accounting, corporate tax compliance, statutory audit assurance, and Virtual CFO
              advisory for growing enterprises, LLPs, and corporations across India.
            </p>

            <div className="flex items-center gap-4 text-xs text-[var(--fd-text-tertiary)] pt-2">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[var(--fd-status-done)]" />
                <span>AES-256 Encrypted Portals</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--fd-status-progress)]" />
                <span>ICAI Standards on Auditing</span>
              </span>
            </div>
          </div>

          {/* Col 1: Practice Areas */}
          <div>
            <h3 className="text-xs font-bold text-[var(--fd-text-primary)] uppercase tracking-wider mb-3">
              Practice Areas
            </h3>
            <ul className="space-y-2">
              <li>
                <a href="#services" className="hover:text-[var(--fd-text-primary)] transition-colors">
                  Corporate Tax & GST
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-[var(--fd-text-primary)] transition-colors">
                  Corporate Advisory & CFO
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-[var(--fd-text-primary)] transition-colors">
                  Cloud Bookkeeping & MIS
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-[var(--fd-text-primary)] transition-colors">
                  Statutory Audit u/s 44AB
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-[var(--fd-text-primary)] transition-colors">
                  Virtual CFO Advisory
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-[var(--fd-text-primary)] transition-colors">
                  ROC & MCA Secretarial
                </a>
              </li>
            </ul>
          </div>

          {/* Col 2: Client Resources */}
          <div>
            <h3 className="text-xs font-bold text-[var(--fd-text-primary)] uppercase tracking-wider mb-3">
              Client Experience
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/sign-in?portal=client" className="hover:text-[var(--fd-text-primary)] transition-colors flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5 text-[var(--fd-accent)]" />
                  <span>Client Portal Sign In</span>
                </Link>
              </li>
              <li>
                <Link to="/team" className="hover:text-[var(--fd-text-primary)] transition-colors font-medium text-[var(--fd-accent)]">
                  Leadership & CA Partners â†’
                </Link>
              </li>
              <li>
                <a href="/#compliance-radar" className="hover:text-[var(--fd-text-primary)] transition-colors">
                  Statutory Filing Radar
                </a>
              </li>
              <li>
                <a href="/#entity-roadmap" className="hover:text-[var(--fd-text-primary)] transition-colors">
                  Entity Compliance Roadmaps
                </a>
              </li>
              <li>
                <a href="/#portal-preview" className="hover:text-[var(--fd-text-primary)] transition-colors">
                  Digital Portal Walkthrough
                </a>
              </li>
              <li>
                <a href="/#consultation" className="hover:text-[var(--fd-text-primary)] transition-colors">
                  Schedule Free Advisory
                </a>
              </li>
              <li>
                <a href="/#faq" className="hover:text-[var(--fd-text-primary)] transition-colors">
                  Client FAQs
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Practice Office & Contact */}
          <div>
            <h3 className="text-xs font-bold text-[var(--fd-text-primary)] uppercase tracking-wider mb-3">
              Office & Contact
            </h3>
            <ul className="space-y-2.5 text-[var(--fd-text-secondary)]">
              <li>
                <strong className="text-[var(--fd-text-primary)] block">Practice Office:</strong>
                <address className="not-italic text-[11px] text-[var(--fd-text-tertiary)] leading-relaxed">
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=Krushnam+Plaza,+Opposite+District+Court,+Siddhpur+Char+Rasta,+Patan,+Gujarat+384265"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[var(--fd-accent)] transition-colors inline-block break-words hyphens-auto max-w-[250px] sm:max-w-none"
                  >
                    F-19 Krushnam Plaza opposite the District Court, near Siddhpur Char Rasta, Sardar Ganj, Patan, Gujarat 384265
                  </a>
                </address>
              </li>
              <li>
                <strong className="text-[var(--fd-text-primary)] block">Direct Helpline:</strong>
                <a
                  href="tel:+919737046913"
                  className="text-[11px] font-semibold text-[var(--fd-accent)] hover:underline"
                >
                  +91 97370 46913
                </a>
              </li>
              <li className="pt-1">
                <Link
                  to="/sign-in?portal=admin"
                  className="inline-flex items-center gap-1 text-[var(--fd-accent)] hover:underline text-xs"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Practice Team Workspace</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Disclaimer */}
        <div className="mt-12 border-t border-[var(--fd-border-subtle)] pt-6 text-[11px] text-[var(--fd-text-tertiary)] leading-relaxed space-y-3">
          <p>
            <strong>Regulatory & Professional Disclaimer:</strong> JV Tax Consultancy is a professional accounting, tax,
            and corporate financial advisory practice. Information provided on this website is for general informational
            purposes and should not be construed as unilateral legal or tax advice. All client engagements are conducted
            in accordance with the Code of Ethics and guidelines prescribed by the Institute of Chartered Accountants of India (ICAI).
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-[10px]">
            <div>Â© {new Date().getFullYear()} JV Tax Consultancy. All rights reserved.</div>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <span>Non-Disclosure Protected</span>
              <span>AES-256 Vault Architecture</span>
              <span>ICAI Standards on Auditing</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
