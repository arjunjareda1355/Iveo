import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Instagram, Youtube } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { Button } from '../ui/Button';
import { Container } from '../ui/Container';
import { IveoUserButton } from '../../auth/IvioUserButton';
import { useIveoSession } from '../../auth/useIvioSession';
import { copy } from '../../content/copy';
import { useScrollSpy } from '../../hooks/useScrollSpy';
import { cn } from '../../lib/cn';

const SECTION_IDS = ['how', 'vibes', 'features', 'pricing', 'faq'];

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeId = useScrollSpy(SECTION_IDS, 120);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const { isLoaded, isSignedIn } = useIveoSession();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll and handle Escape key when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setMobileMenuOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [mobileMenuOpen]);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 h-16 w-full transition-all duration-200',
        isScrolled
          ? 'bg-[#FAFAFA]/80 backdrop-blur-[12px] border-b border-border'
          : 'bg-transparent border-b border-transparent'
      )}
    >
      <Container className="h-full flex items-center justify-between">
        {/* Left: Logo */}
        <div className="shrink-0 flex items-center">
          <Logo tone="light" size="md" />
        </div>

        {/* Center: Desktop Navigation Links (1024px and up) */}
        <nav
          aria-label="Main Navigation"
          className="hidden lg:flex items-center gap-6 xl:gap-7 text-[14px] font-medium"
        >
          {copy.nav.links.map((link) => {
            const targetId = link.href.replace('#', '');
            const isActive = activeId === targetId;

            return (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  'transition-colors duration-120 select-none py-1.5 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ink rounded-xs',
                  isActive ? 'text-ink font-semibold' : 'text-muted hover:text-ink'
                )}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* Right: Desktop Actions */}
        <div className="hidden lg:flex items-center shrink-0">
          {/* Iveo Social Media Accounts CTA */}
          <div className="flex items-center gap-1 mr-3 pr-3 border-r border-border">
            <a
              href="https://youtube.com/@iveosite"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="iveo on YouTube"
              title="iveo on YouTube (@iveosite)"
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-[#FF0000] hover:bg-surface-2 transition-all duration-120 cursor-pointer"
            >
              <Youtube size={17} strokeWidth={1.75} />
            </a>
            <a
              href="https://www.instagram.com/iveo.site"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="iveo on Instagram"
              title="iveo on Instagram (@iveo.site)"
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-[#E4405F] hover:bg-surface-2 transition-all duration-120 cursor-pointer"
            >
              <Instagram size={17} strokeWidth={1.75} />
            </a>
          </div>

          {!isLoaded ? (
            // Reserved width placeholder while Clerk loads to avoid any layout shift
            <div className="w-[190px] h-10" aria-hidden="true" />
          ) : isSignedIn ? (
            <div className="flex items-center gap-3">
              <Button as={Link} to="/dashboard" variant="primary" size="md">
                {copy.nav.dashboard}
              </Button>
              <IveoUserButton />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button as={Link} to="/login" variant="ghost" size="md">
                {copy.nav.logIn}
              </Button>
              <Button as={Link} to="/signup" variant="primary" size="md">
                {copy.nav.getStarted}
              </Button>
            </div>
          )}
        </div>

        {/* Right: Mobile & Tablet Trigger + CTA (below 1024px) */}
        <div className="flex lg:hidden items-center gap-1.5 sm:gap-2 shrink-0">
          {!isLoaded ? (
            <div className="w-[100px] h-10" aria-hidden="true" />
          ) : isSignedIn ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button as={Link} to="/dashboard" variant="primary" size="md">
                {copy.nav.dashboard}
              </Button>
              <IveoUserButton />
            </div>
          ) : (
            <Button as={Link} to="/signup" variant="primary" size="md">
              {copy.nav.getStarted}
            </Button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? copy.nav.closeMenu : copy.nav.openMenu}
            aria-expanded={mobileMenuOpen}
            className="w-10 h-10 flex items-center justify-center rounded-[10px] text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ink transition-colors duration-120 cursor-pointer"
          >
            {mobileMenuOpen ? (
              <X size={20} strokeWidth={1.5} />
            ) : (
              <Menu size={20} strokeWidth={1.5} />
            )}
          </button>
        </div>
      </Container>

      {/* Mobile Menu Backdrop & Sheet */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 top-16 z-50 flex flex-col justify-between"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeMenu();
            }
          }}
        >
          {/* Menu Drawer */}
          <div
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
            className="w-full bg-surface border-b border-border shadow-lg transition-all duration-200 overflow-y-auto max-h-[calc(100vh-140px)] shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-2 pb-6 flex flex-col">
              <nav className="flex flex-col divide-y divide-border">
                {copy.nav.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    className="h-14 flex items-center text-[18px] font-medium text-ink hover:text-ink-2 transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-ink"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>

              <div className="mt-6 flex flex-col gap-3">
                {isSignedIn ? (
                  <>
                    <Button
                      as={Link}
                      to="/dashboard"
                      variant="primary"
                      size="lg"
                      fullWidth
                      onClick={closeMenu}
                    >
                      {copy.nav.dashboard}
                    </Button>
                    <Button
                      as={Link}
                      to="/account"
                      variant="secondary"
                      size="lg"
                      fullWidth
                      onClick={closeMenu}
                    >
                      {copy.nav.manageAccount}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      as={Link}
                      to="/login"
                      variant="secondary"
                      size="lg"
                      fullWidth
                      onClick={closeMenu}
                    >
                      {copy.nav.logIn}
                    </Button>
                    <Button
                      as={Link}
                      to="/signup"
                      variant="primary"
                      size="lg"
                      fullWidth
                      onClick={closeMenu}
                    >
                      {copy.nav.getStarted}
                    </Button>
                  </>
                )}
              </div>

              {/* Iveo Social Media Accounts in Mobile Menu (icons only) */}
              <div className="mt-6 pt-4 border-t border-border flex items-center justify-center gap-3">
                <a
                  href="https://youtube.com/@iveosite"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="iveo on YouTube"
                  title="iveo on YouTube (@iveosite)"
                  className="w-10 h-10 rounded-full bg-surface-2 hover:bg-surface border border-border flex items-center justify-center text-[#FF0000] transition-colors"
                >
                  <Youtube size={18} strokeWidth={1.75} />
                </a>
                <a
                  href="https://www.instagram.com/iveo.site"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="iveo on Instagram"
                  title="iveo on Instagram (@iveo.site)"
                  className="w-10 h-10 rounded-full bg-surface-2 hover:bg-surface border border-border flex items-center justify-center text-[#E4405F] transition-colors"
                >
                  <Instagram size={18} strokeWidth={1.75} />
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Screen Tap Area: clicking anywhere on bottom screen auto-closes menu */}
          <div
            aria-label="Close menu by tapping bottom screen"
            onClick={closeMenu}
            className="flex-1 w-full bg-black/40 backdrop-blur-xs transition-opacity duration-200 cursor-pointer min-h-[80px]"
          />
        </div>
      )}
    </header>
  );
};
