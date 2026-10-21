import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Share2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { pageUrl, SITE_ORIGIN } from '../../lib/site';
import {
  makeQrSvg,
  makeQrPngDataUrl,
  downloadPng,
  downloadSvg,
} from '../../lib/qr';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  displayName?: string;
  isPublished?: boolean;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  username,
  displayName,
  isPublished = true,
}) => {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const fullUrl = pageUrl(username);
  const displayAddress = fullUrl.replace(/^https?:\/\//i, '');

  // Generate QR lazily when opened
  useEffect(() => {
    if (!isOpen || !username) return;

    let isMounted = true;
    setIsGenerating(true);
    setQrError(false);

    Promise.all([makeQrSvg(fullUrl), makeQrPngDataUrl(fullUrl)])
      .then(([svg, png]) => {
        if (!isMounted) return;
        setQrSvg(svg);
        setQrPngDataUrl(png);
        setIsGenerating(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setQrError(true);
        setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, username, fullUrl]);

  // Trap focus and lock body scroll
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';

      const timer = setTimeout(() => {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable && focusable.length > 0) {
          focusable[0].focus();
        }
      }, 50);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
        if (previouslyFocusedRef.current) {
          previouslyFocusedRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      showToast('Link copied');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast('Failed to copy');
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: displayName || `@${username}`,
        text: 'My page on iveo',
        url: fullUrl,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Ignored silently
        return;
      }
      showToast("Couldn't share. Try again.");
    }
  };

  const handleDownloadPng = () => {
    if (qrPngDataUrl) {
      downloadPng(qrPngDataUrl, username);
    }
  };

  const handleDownloadSvg = () => {
    if (qrSvg) {
      downloadSvg(qrSvg, username);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-150"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[440px] bg-surface border border-border rounded-t-[20px] sm:rounded-[20px] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.12)] max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
      >
        {/* Visual drag indicator for mobile sheet */}
        <div className="sm:hidden flex justify-center -mt-2 mb-4">
          <div className="w-[36px] h-[5px] rounded-full bg-border" />
        </div>

        <div className="flex items-center justify-between">
          <h2
            id="share-dialog-title"
            className="text-[20px] font-semibold text-ink leading-tight"
          >
            Share your page
          </h2>
          <button
            onClick={onClose}
            aria-label="Close share dialog"
            className="w-8 h-8 rounded-[8px] flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors duration-120"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-5">
          {/* 1. Link row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-11 px-3.5 bg-surface-2 border border-border rounded-[10px] flex items-center overflow-hidden">
              <span className="font-mono text-[14px] sm:text-[15px] text-ink truncate select-all">
                {displayAddress}
              </span>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={handleCopyLink}
              className="shrink-0 min-w-[96px]"
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>

          {/* 2. Native Share button (if supported) */}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button
              variant="secondary"
              size="md"
              onClick={handleNativeShare}
              fullWidth
            >
              <Share2 size={16} strokeWidth={1.5} />
              <span>Share...</span>
            </Button>
          )}

          {/* 3. QR code block */}
          <div className="flex flex-col items-center">
            <div className="w-full flex flex-col items-center justify-center bg-white border border-border rounded-[14px] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="w-[224px] h-[224px] flex items-center justify-center bg-white">
                {qrSvg ? (
                  <img
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`}
                    alt={`QR code that opens ${fullUrl}`}
                    width={224}
                    height={224}
                    className="w-[224px] h-[224px] block object-contain"
                  />
                ) : qrError ? (
                  <div className="flex flex-col items-center text-center p-4">
                    <p className="text-[13px] text-muted">
                      We couldn't create the QR code. Try again.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setQrError(false);
                        setIsGenerating(true);
                        Promise.all([makeQrSvg(fullUrl), makeQrPngDataUrl(fullUrl)])
                          .then(([svg, png]) => {
                            setQrSvg(svg);
                            setQrPngDataUrl(png);
                            setIsGenerating(false);
                          })
                          .catch(() => {
                            setQrError(true);
                            setIsGenerating(false);
                          });
                      }}
                      className="mt-2"
                    >
                      Try again
                    </Button>
                  </div>
                ) : (
                  <div className="w-[224px] h-[224px] bg-surface-2 rounded-[8px]" />
                )}
              </div>
            </div>

            <div className="mt-3 w-full grid grid-cols-2 gap-2.5">
              <Button
                variant="secondary"
                size="md"
                onClick={handleDownloadPng}
                disabled={!qrPngDataUrl || isGenerating}
                fullWidth
              >
                Download PNG
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={handleDownloadSvg}
                disabled={!qrSvg || isGenerating}
                fullWidth
              >
                Download SVG
              </Button>
            </div>

            <p className="mt-2.5 text-center text-[13px] text-muted leading-relaxed">
              Scans to iveo.site/{username}. Print it at least 2 cm (0.8 in) wide.
            </p>
          </div>

          {/* 4. Notice if page is unpublished/hidden */}
          {!isPublished && (
            <div className="flex items-center justify-between gap-3 bg-surface-2 border border-border rounded-[10px] p-3 text-[14px] text-muted">
              <span>Your page is hidden, so visitors will see an unavailable message.</span>
              <Button
                as={Link}
                to="/dashboard/settings"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={onClose}
              >
                Open settings
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
