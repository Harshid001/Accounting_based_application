import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  Menu,
  PhoneCall,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/domain/ThemeToggle';
import { LanguageSwitcher } from '@/components/domain/LanguageSwitcher';
import { useLanguage } from '@/context/LanguageContext';
import { useSession } from '@/context/SessionContext';
import { homePathFor } from '@/lib/permissions';
import { JVLogo } from '@/components/brand/JVLogo';

export function LandingNavbar() {
  const { status, user } = useSession();
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const isAuthenticated = status === 'authenticated' && user !== null;
  const userHome = isAuthenticated ? homePathFor(user.role) : '/sign-in?portal=client';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 16);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    if (mobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const navLinks = [
    { label: t('nav.services', 'Services'), href: '/#services' },
    { label: t('nav.whyUs', 'Why Us'), href: '/#firm-advantage' },
    { label: t('nav.teamLogin', 'Our Team'), href: '/team' }, // fallback
    { label: t('nav.faq', 'FAQ'), href: '/#faq' },
  ];

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? 'border-b border-[var(--fd-border)] bg-[var(--fd-bg)]/92 shadow-md shadow-black/10 backdrop-blur-xl'
          : 'border-b border-[var(--fd-border-subtle)] bg-[var(--fd-bg)]/80 backdrop-blur-md'
      }`}
    >
      {/* Delicate top gradient accent line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--fd-accent)]/50 to-transparent"
        aria-hidden="true"
      />

      {/* 3-column grid: [logo] [nav island] [actions] — center column is truly centered */}
      <div className="mx-auto grid h-14 sm:h-[68px] max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 px-3 sm:px-6 lg:px-10">

        {/* Col 1 — Brand Logo (left-anchored) */}
        <div className="flex items-center justify-start">
          <Link
            to="/"
            className="group relative flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--fd-focus-ring)] rounded-full transition-all duration-200 hover:scale-105 active:scale-95 hover:drop-shadow-[0_0_12px_rgba(255,106,0,0.35)]"
            aria-label="JV Tax Consultancy Home"
            title="JV Tax Consultancy - Chartered Accountants"
          >
            <JVLogo size="md" />
          </Link>
        </div>

        {/* Col 2 — Nav Island (center, naturally bounded by grid) */}
        <nav
          className="hidden md:flex items-center gap-1 rounded-full border border-[var(--fd-border)] bg-[var(--fd-surface-1)]/80 px-2 py-1.5 text-[13px] font-medium backdrop-blur-xl shadow-xs"
          aria-label="Main Navigation"
        >
          {navLinks.map((link) => {
            const isInternal = link.href.startsWith('/') && !link.href.includes('#');
            const cls =
              'rounded-full px-4 py-1.5 text-[var(--fd-text-secondary)] transition-all duration-150 hover:bg-[var(--fd-surface-2)] hover:text-[var(--fd-text-primary)] active:scale-95 tracking-tight whitespace-nowrap';
            return isInternal ? (
              <Link key={link.href} to={link.href} className={cls}>
                {link.label}
              </Link>
            ) : (
              <a key={link.href} href={link.href} className={cls}>
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* Col 3 — Right Actions (right-anchored) */}
        <div className="hidden md:flex items-center justify-end gap-3">
          {isAuthenticated ? (
            <Button asChild variant="primary" size="sm" className="rounded-full shadow-xs font-semibold px-5 h-8">
              <Link to={userHome} className="flex items-center gap-2">
                <span>Go to {user.role === 'client' ? 'Client Portal' : 'Workspace'}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <>
              {/* Client Portal — bordered pill with live status dot */}
              <Link
                to="/sign-in?portal=client"
                className="hidden lg:inline-flex items-center gap-2.5 rounded-full border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-4 py-[7px] text-[13px] font-medium text-[var(--fd-text-primary)] shadow-xs transition-all duration-150 hover:bg-[var(--fd-surface-2)] hover:border-[var(--fd-border-strong)] active:scale-95 whitespace-nowrap"
              >
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>{t('nav.clientPortal', 'Client Portal')}</span>
              </Link>

              {/* Book Consultation — primary CTA */}
              <Button
                asChild
                variant="primary"
                size="sm"
                className="rounded-full shadow-sm hover:shadow-[0_8px_24px_-8px_rgba(255,106,0,0.4)] transition-all font-semibold px-5 h-8 whitespace-nowrap"
              >
                <a href="#consultation" className="flex items-center gap-2">
                  <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t('nav.bookConsultation', 'Book Consultation')}</span>
                </a>
              </Button>
            </>
          )}

          {/* Vertical divider */}
          <span className="h-5 w-px bg-[var(--fd-border-subtle)]" aria-hidden="true" />

          {/* Utility icons: Language · Theme · Staff */}
          <div className="flex items-center gap-1">
            <LanguageSwitcher compact />
            <ThemeToggle />
            <Link
              to="/desktop-download"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--fd-text-tertiary)] hover:text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-2)] transition-colors"
              title="Download FirmDesk Desktop App"
              aria-label="Download FirmDesk Desktop App"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>




        {/* Mobile Actions: Language + Theme + Hamburger */}
        <div className="flex items-center gap-1.5 md:hidden">
          <LanguageSwitcher compact />
          <ThemeToggle />
          <button
            type="button"
            id="mobile-menu-toggle"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-1)] text-[var(--fd-text-secondary)] shadow-xs hover:bg-[var(--fd-surface-2)] hover:text-[var(--fd-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--fd-focus-ring)]"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          className="border-b border-[var(--fd-border)] bg-[var(--fd-surface-1)]/98 backdrop-blur-xl px-4 pt-3 pb-6 md:hidden shadow-2xl animate-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[var(--fd-border-subtle)]">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--fd-text-tertiary)]">
              Navigation
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Client Portal 24/7 Live</span>
            </div>
          </div>

          <nav className="grid grid-cols-1 xs:grid-cols-2 gap-2 py-3">
            {navLinks.map((link) => {
              const isInternal = link.href.startsWith('/') && !link.href.includes('#');
              return isInternal ? (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={closeMenu}
                  className="rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)]/50 px-3.5 py-2.5 text-center text-sm font-medium text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-2)] hover:text-[var(--fd-text-primary)] transition-colors"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className="rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)]/50 px-3.5 py-2.5 text-center text-sm font-medium text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-2)] hover:text-[var(--fd-text-primary)] transition-colors"
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          <div className="border-t border-[var(--fd-border-subtle)] pt-4 flex flex-col gap-2.5">
            {isAuthenticated ? (
              <Button asChild variant="primary" size="md" className="w-full">
                <Link to={userHome} onClick={closeMenu} className="flex items-center justify-center gap-2">
                  <span>Open {user.role === 'client' ? 'Client Portal' : 'Workspace'}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="primary" size="md" className="w-full justify-center shadow-sm">
                  <a href="#consultation" onClick={closeMenu} className="flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                    <span>{t('nav.bookConsultation', 'Book a Free Consultation')}</span>
                  </a>
                </Button>
                <Button asChild variant="secondary" size="md" className="w-full justify-center">
                  <Link to="/sign-in?portal=client" onClick={closeMenu} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <UserCheck className="h-4 w-4 text-[var(--fd-accent)]" aria-hidden="true" />
                    <span>{t('nav.clientPortal', 'Client Portal Sign In')}</span>
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="md" className="w-full justify-center text-xs">
                  <Link to="/desktop-download" onClick={closeMenu} className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>FirmDesk Desktop App</span>
                  </Link>
                </Button>
              </>
            )}

            {/* Direct Helpline snippet */}
            <div className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-[var(--fd-surface-2)]/60 px-3 py-2 text-xs text-[var(--fd-text-secondary)]">
              <PhoneCall className="h-3.5 w-3.5 text-[var(--fd-accent)]" />
              <span>Partner Direct Helpline: </span>
              <a
                href="tel:+919737046913"
                className="font-bold text-[var(--fd-text-primary)] hover:underline"
              >
                +91 97370 46913
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
