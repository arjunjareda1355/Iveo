import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CreditCard,
  ExternalLink,
  HelpCircle,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useIveoSession } from './useIvioSession';
import { ProBadge } from '../components/plan/ProBadge';
import { BottomSheet } from '../components/ui/BottomSheet';
import { pageUrl } from '../lib/site';

export const IveoUserButton: React.FC = () => {
  const session = useIveoSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => {
      setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, isMobile]);

  if (!session.isLoaded || !session.isSignedIn) {
    return <div className="w-9 h-9 rounded-full bg-surface-2 shrink-0" aria-hidden="true" />;
  }

  const displayName = session.displayName || session.username || 'iveo creator';
  const handle = session.username ? `@${session.username}` : session.primaryEmail || '';
  const initials = (displayName || 'IV')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'IV';

  const preserveDemoSearch = (() => {
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === '1' || params.get('autostart') === '1') {
      const kept = new URLSearchParams();
      if (params.get('demo') === '1') kept.set('demo', '1');
      if (params.get('autostart') === '1') kept.set('autostart', '1');
      return `?${kept.toString()}`;
    }
    return '';
  })();

  const publicHref = session.username ? pageUrl(session.username) : 'https://iveo.site';

  const goToSettingsSection = (hash: string) => {
    setOpen(false);
    navigate(`/dashboard/settings${preserveDemoSearch}${hash}`);
    setTimeout(() => {
      const id = hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleSignOut = async () => {
    setOpen(false);
    await session.signOut();
  };

  const menuContent = (
    <div className="flex flex-col">
      {/* Non-clickable header row */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-divider select-none">
        {session.imageUrl ? (
          <img
            src={session.imageUrl}
            alt=""
            className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center text-[13px] font-semibold text-ink shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[14px] font-semibold text-ink truncate">
              {displayName}
            </span>
            {session.isPro && <ProBadge className="shrink-0" />}
          </div>
          {handle && (
            <span className="text-[12px] text-muted truncate block mt-0.5">
              {handle}
            </span>
          )}
        </div>
      </div>

      {/* Menu links */}
      <div className="py-1.5 flex flex-col">
        <a
          href={publicHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
          className="min-h-[44px] px-4 flex items-center gap-3 text-[14px] font-medium text-ink hover:bg-surface-2 transition-colors"
        >
          <ExternalLink size={18} strokeWidth={1.5} className="text-muted shrink-0" />
          <span>View my page</span>
        </a>

        <button
          type="button"
          onClick={() => goToSettingsSection('#account')}
          className="min-h-[44px] px-4 flex items-center gap-3 text-[14px] font-medium text-ink hover:bg-surface-2 transition-colors text-left cursor-pointer"
        >
          <ShieldCheck size={18} strokeWidth={1.5} className="text-muted shrink-0" />
          <span>Account &amp; security</span>
        </button>

        <button
          type="button"
          onClick={() => goToSettingsSection('#plan')}
          className="min-h-[44px] px-4 flex items-center gap-3 text-[14px] font-medium text-ink hover:bg-surface-2 transition-colors text-left cursor-pointer"
        >
          <CreditCard size={18} strokeWidth={1.5} className="text-muted shrink-0" />
          <span>Plan &amp; billing</span>
        </button>

        <a
          href="https://help.iveo.site"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
          className="min-h-[44px] px-4 flex items-center gap-3 text-[14px] font-medium text-ink hover:bg-surface-2 transition-colors"
        >
          <HelpCircle size={18} strokeWidth={1.5} className="text-muted shrink-0" />
          <span>Help &amp; support</span>
        </a>
      </div>

      <div className="border-t border-divider py-1.5">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full min-h-[44px] px-4 flex items-center gap-3 text-[14px] font-medium text-[color:var(--error,#B3261E)] hover:bg-red-50/70 transition-colors text-left cursor-pointer"
        >
          <LogOut size={18} strokeWidth={1.5} className="shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="relative flex items-center justify-center shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full hover:bg-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-ink cursor-pointer"
      >
        {session.imageUrl ? (
          <img
            src={session.imageUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover border border-border"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-ink text-surface flex items-center justify-center text-[12px] font-semibold">
            {initials}
          </span>
        )}
      </button>

      {/* Desktop Dropdown */}
      {open && !isMobile && (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-[calc(100%+6px)] w-64 rounded-[16px] bg-surface border border-border shadow-[0_12px_32px_rgba(10,10,10,0.12)] overflow-hidden z-50"
        >
          {menuContent}
        </div>
      )}

      {/* Mobile Bottom Sheet */}
      {isMobile && (
        <BottomSheet
          isOpen={open}
          onClose={() => setOpen(false)}
          ariaLabel="Account menu"
        >
          {menuContent}
        </BottomSheet>
      )}
    </div>
  );
};

// Backward-compatible alias
export const IvioUserButton = IveoUserButton;
