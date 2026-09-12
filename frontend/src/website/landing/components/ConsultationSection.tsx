import { useState } from 'react';
import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { JVLogoMark } from '@/components/brand/JVLogo';

export function ConsultationSection() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    entityType: 'Private Limited Company',
    service: 'Corporate Tax & GST Compliance',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email) return;
    setSubmitted(true);
  };

  return (
    <section id="consultation" className="scroll-mt-20 py-16 lg:py-24 border-t border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--fd-accent-subtle-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--fd-accent)] uppercase tracking-wider">
            Partner Consultation
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--fd-text-primary)] sm:text-4xl">
            Schedule a Confidential Advisory Session
          </h2>
          <p className="mt-3 text-base text-[var(--fd-text-secondary)]">
            Discuss your company&apos;s tax posture, corporate financials, or statutory compliance with an experienced
            Chartered Accountant. No obligation, strictly confidential.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Direct Practice Info & Partner Promises */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-bg)] p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <JVLogoMark size={40} />
                <div>
                  <h3 className="text-base font-bold text-[var(--fd-text-primary)]">JV Tax Consultancy</h3>
                  <p className="text-xs text-[var(--fd-text-secondary)]">Chartered Advisory & Compliance</p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-[var(--fd-text-secondary)] leading-relaxed">
                We believe in proactive, year-round client partnershipsâ€”not once-a-year transactional tax filings.
                Get in touch to discover how we streamline your compliance and protect your cash flow.
              </p>

              <div className="space-y-4 text-xs sm:text-sm border-t border-[var(--fd-border-subtle)] pt-6 text-[var(--fd-text-secondary)]">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-[var(--fd-accent)] shrink-0" />
                  <a href="mailto:jigar.taxadvocate@gmail.com" className="hover:text-[var(--fd-text-primary)]">
                    jigar.taxadvocate@gmail.com
                  </a>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-[var(--fd-status-done)] shrink-0" />
                  <a
                    href="tel:+919737046913"
                    className="font-semibold hover:text-[var(--fd-text-primary)] transition-colors"
                  >
                    +91 97370 46913
                  </a>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-[var(--fd-status-progress)] shrink-0" />
                  <span>Monday â€“ Saturday, 9:30 AM â€“ 6:30 PM IST</span>
                </div>

                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-[var(--fd-accent)] shrink-0 mt-0.5" />
                  <address className="not-italic leading-relaxed">
                    F-19 Krushnam Plaza opposite the District Court, near Siddharpur Char Rasta, Sardar Ganj, Patan, Gujarat 384265
                  </address>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="rounded-xl bg-[var(--fd-surface-2)] p-4 space-y-2 border border-[var(--fd-border-subtle)]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--fd-text-primary)]">
                  <ShieldCheck className="h-4 w-4 text-[var(--fd-status-done)]" />
                  <span>Professional Confidentiality & NDA</span>
                </div>
                <p className="text-[11px] text-[var(--fd-text-secondary)] leading-relaxed">
                  All shared financials, tax records, and JV agreements are protected under institutional confidentiality agreements.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Consultation Request Form */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-bg)] p-6 sm:p-8 shadow-sm">
              {submitted ? (
                <div className="text-center py-10 space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--fd-status-done)]/15 text-[var(--fd-status-done)]">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-[var(--fd-text-primary)]">
                    Consultation Request Received
                  </h3>
                  <p className="max-w-md mx-auto text-xs sm:text-sm text-[var(--fd-text-secondary)] leading-relaxed">
                    Thank you, <strong>{formData.fullName}</strong>. A Senior Partner specializing in{' '}
                    <span className="text-[var(--fd-accent)] font-semibold">{formData.service}</span> will review your company details
                    and reach out via email ({formData.email}) within 24 business hours.
                  </p>
                  <div className="pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSubmitted(false);
                        setFormData({
                          fullName: '',
                          email: '',
                          phone: '',
                          companyName: '',
                          entityType: 'Private Limited Company',
                          service: 'Corporate Tax & GST Compliance',
                          message: '',
                        });
                      }}
                    >
                      Submit Another Inquiry
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarCheck className="h-4 w-4 text-[var(--fd-accent)]" />
                    <h3 className="text-base font-bold text-[var(--fd-text-primary)]">
                      Tell Us About Your Requirement
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label htmlFor="contact-fullName" className="block text-xs font-semibold text-[var(--fd-text-secondary)] mb-1">
                        Full Name *
                      </label>
                      <input
                        id="contact-fullName"
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder="e.g. Rajesh Singhania"
                        className="w-full rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-3 py-2 text-xs text-[var(--fd-text-primary)] placeholder-[var(--fd-text-tertiary)] focus:border-[var(--fd-accent)] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="contact-email" className="block text-xs font-semibold text-[var(--fd-text-secondary)] mb-1">
                        Work Email *
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="rajesh@company.com"
                        className="w-full rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-3 py-2 text-xs text-[var(--fd-text-primary)] placeholder-[var(--fd-text-tertiary)] focus:border-[var(--fd-accent)] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label htmlFor="contact-phone" className="block text-xs font-semibold text-[var(--fd-text-secondary)] mb-1">
                        Phone / Mobile
                      </label>
                      <input
                        id="contact-phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+91 97370 46913"
                        className="w-full rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-3 py-2 text-xs text-[var(--fd-text-primary)] placeholder-[var(--fd-text-tertiary)] focus:border-[var(--fd-accent)] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="contact-companyName" className="block text-xs font-semibold text-[var(--fd-text-secondary)] mb-1">
                        Company / Business Name
                      </label>
                      <input
                        id="contact-companyName"
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        placeholder="e.g. Acme Industries / Company Name"
                        className="w-full rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-3 py-2 text-xs text-[var(--fd-text-primary)] placeholder-[var(--fd-text-tertiary)] focus:border-[var(--fd-accent)] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label htmlFor="contact-entityType" className="block text-xs font-semibold text-[var(--fd-text-secondary)] mb-1">
                        Entity Structure
                      </label>
                      <select
                        id="contact-entityType"
                        value={formData.entityType}
                        onChange={(e) => setFormData({ ...formData, entityType: e.target.value })}
                        className="w-full rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-3 py-2 text-xs text-[var(--fd-text-primary)] focus:border-[var(--fd-accent)] focus:outline-none"
                      >
                        <option value="Private Limited Company">Private Limited Company</option>
                        <option value="Corporate Group / Multi-Entity">Corporate Group / Multi-Entity</option>
                        <option value="Limited Liability Partnership">Limited Liability Partnership (LLP)</option>
                        <option value="Partnership Firm">Partnership Firm</option>
                        <option value="Sole Proprietorship / MSME">Sole Proprietorship / MSME</option>
                        <option value="Individual / High Net Worth">Individual / Director ITR</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="contact-service" className="block text-xs font-semibold text-[var(--fd-text-secondary)] mb-1">
                        Primary Advisory Area
                      </label>
                      <select
                        id="contact-service"
                        value={formData.service}
                        onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                        className="w-full rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-3 py-2 text-xs text-[var(--fd-text-primary)] focus:border-[var(--fd-accent)] focus:outline-none"
                      >
                        <option value="Corporate Tax & GST Compliance">Corporate Tax & GST Compliance</option>
                        <option value="Corporate Financial Structuring & Advisory">Corporate Structuring & Advisory</option>
                        <option value="Full-Stack Cloud Bookkeeping & MIS">Full-Stack Bookkeeping & MIS</option>
                        <option value="Statutory Audit & Tax Audit u/s 44AB">Statutory Audit & Tax Audit</option>
                        <option value="Virtual CFO & Strategic Financial Modeling">Virtual CFO & Financial Modeling</option>
                        <option value="ROC / MCA Corporate Secretarial">ROC / MCA Corporate Secretarial</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="block text-xs font-semibold text-[var(--fd-text-secondary)] mb-1">
                      Brief Description of Requirements
                    </label>
                    <textarea
                      id="contact-message"
                      rows={3}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Share your current challenges, turnover scale, or filing targets..."
                      className="w-full rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-3 py-2 text-xs text-[var(--fd-text-primary)] placeholder-[var(--fd-text-tertiary)] focus:border-[var(--fd-accent)] focus:outline-none resize-none"
                    />
                  </div>

                  <div className="pt-2">
                    <Button type="submit" variant="primary" size="md" className="w-full justify-center">
                      <Send className="h-4 w-4 mr-2" />
                      <span>Request Partner Consultation</span>
                    </Button>
                    <p className="mt-2 text-[11px] text-center text-[var(--fd-text-tertiary)]">
                      We respect your privacy. No spam. A senior partner will contact you directly.
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Full-Width Verified Practice Premises & Interactive Location Map */}
        <div className="mt-12 overflow-hidden rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] shadow-md">
          {/* Top Header Bar */}
          <div className="border-b border-[var(--fd-border)] bg-[var(--fd-surface-2)]/60 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start sm:items-center gap-3">
                <JVLogoMark size={32} badge />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--fd-text-primary)]">
                      JV Tax Consultancy Â· Registered Practice Premises
                    </h4>
                    <span className="hidden sm:inline-flex rounded-full border border-[var(--fd-status-done)]/30 bg-[var(--fd-status-done)]/10 px-2.5 py-0.5 text-[10px] font-mono font-medium text-[var(--fd-status-done)]">
                      ICAI Reg. Practice
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--fd-text-secondary)] flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[var(--fd-accent)] shrink-0" />
                    <span className="hidden sm:inline">Chambers F-19, Krushnam Plaza, Opp. District Court, near Siddhpur Char Rasta, Sardar Ganj, Patan, Gujarat 384265</span>
                    <span className="inline sm:hidden">Krushnam Plaza, Patan 384265</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Krushnam+Plaza,+Opposite+District+Court,+Siddhpur+Char+Rasta,+Patan,+Gujarat+384265"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-3.5 py-2 text-xs font-semibold text-[var(--fd-text-primary)] shadow-2xs hover:border-[var(--fd-accent)] hover:text-[var(--fd-accent)] transition-all"
                >
                  <MapPin className="h-3.5 w-3.5 text-[var(--fd-accent)]" />
                  <span>Open in Google Maps</span>
                  <ExternalLink className="h-3 w-3 text-[var(--fd-text-tertiary)]" />
                </a>
              </div>
            </div>
          </div>

          {/* Expansive Full-Width Interactive Map */}
          <div className="relative h-80 sm:h-96 md:h-[440px] w-full overflow-hidden bg-[var(--fd-surface-2)]">
            <iframe
              title="JV Tax Consultancy Office Location Map - Krushnam Plaza"
              src="https://maps.google.com/maps?q=Krushnam+Plaza,+Opposite+District+Court,+Siddhpur+Char+Rasta,+Patan,+Gujarat+384265&t=&z=16&ie=UTF8&iwloc=&output=embed"
              className="h-full w-full border-0 contrast-[1.05] dark:contrast-[1.15] dark:invert dark:hue-rotate-180 dark:opacity-90 transition-opacity"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          {/* Bottom Fast Travel & Connectivity Information Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--fd-border-subtle)] border-t border-[var(--fd-border)] bg-[var(--fd-surface-1)] text-xs text-[var(--fd-text-secondary)]">
            <div className="flex items-center gap-2.5 p-3.5 sm:px-5">
              <Building2 className="h-4 w-4 text-[var(--fd-accent)] shrink-0" />
              <div>
                <span className="font-semibold text-[var(--fd-text-primary)] block">Prime Civic Landmark</span>
                <span className="text-[11px] text-[var(--fd-text-tertiary)]">Directly opposite Patan District Court</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3.5 sm:px-5">
              <Clock className="h-4 w-4 text-[var(--fd-status-progress)] shrink-0" />
              <div>
                <span className="font-semibold text-[var(--fd-text-primary)] block">Consultation Hours</span>
                <span className="text-[11px] text-[var(--fd-text-tertiary)]">Mon â€“ Sat: 9:30 AM to 6:30 PM IST</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3.5 sm:px-5">
              <Phone className="h-4 w-4 text-[var(--fd-status-done)] shrink-0" />
              <div>
                <span className="font-semibold text-[var(--fd-text-primary)] block">Direct Chambers Desk</span>
                <a href="tel:+919737046913" className="text-[11px] text-[var(--fd-accent)] hover:underline font-semibold">
                  +91 97370 46913
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
