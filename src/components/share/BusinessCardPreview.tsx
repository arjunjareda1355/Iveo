import React, { useEffect, useRef, useState } from 'react';
import { Mail, Phone, MapPin, RotateCw } from 'lucide-react';
import {
  BusinessCardConfig,
  CARD_BASE_HEIGHT,
  CARD_BASE_WIDTH,
  DEFAULT_BUSINESS_CARD_CONFIG,
  buildBackSocialLinks,
  parseBusinessCardConfig,
  resolveBackCardAppearance,
  resolveFrontCardAppearance,
} from '../../lib/businessCardConfig';
import { getCanvasFontName, loadGoogleFonts } from '../../lib/fonts';
import { isLightHexColor } from '../../lib/colors';
import { makeQrPngDataUrl } from '../../lib/qr';
import { VerifiedTick } from '../ui/VerifiedTick';
import { SocialIcon } from '../phone/SocialIcons';

export interface BusinessCardPreviewProps {
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  socials?: Record<string, string> | null;
  isPro?: boolean;
  qrDataUrl?: string | null;
  side?: 'front' | 'back';
  onSideChange?: (side: 'front' | 'back') => void;
  vibeTheme: {
    bg: string;
    text: string;
    muted: string;
    accent: string;
    buttonBg?: string;
  };
  config?: BusinessCardConfig | null;
}

export const BusinessCardPreview: React.FC<BusinessCardPreviewProps> = ({
  username,
  displayName,
  bio,
  avatarUrl,
  socials,
  isPro = false,
  qrDataUrl,
  side: controlledSide,
  onSideChange,
  vibeTheme,
  config,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.66);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [cardQrUrl, setCardQrUrl] = useState<string | null>(null);
  const [internalSide, setInternalSide] = useState<'front' | 'back'>('front');

  const activeSide = controlledSide ?? internalSide;
  const setActiveSide = (next: 'front' | 'back') => {
    if (controlledSide === undefined) {
      setInternalSide(next);
    }
    onSideChange?.(next);
  };

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const w = el.clientWidth;
      if (w > 0) {
        setScale(w / CARD_BASE_WIDTH);
      }
    };
    updateScale();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const resolved: BusinessCardConfig = {
    ...DEFAULT_BUSINESS_CARD_CONFIG,
    ...(parseBusinessCardConfig(config) || {}),
  };

  useEffect(() => {
    loadGoogleFonts([resolved.fontId, 'instrument-serif']);
  }, [resolved.fontId]);

  const cleanUsername = (username || 'creator').toLowerCase().trim();
  const frontApp = resolveFrontCardAppearance(resolved, vibeTheme);
  const backApp = resolveBackCardAppearance(resolved, vibeTheme);

  useEffect(() => {
    if (resolved.showQr === false) return;
    let mounted = true;
    const targetUrl = `https://iveo.site/${cleanUsername}?src=qr`;
    makeQrPngDataUrl(targetUrl, {
      darkColor: backApp.qrFg,
      lightColor: backApp.qrBg,
      margin: 2,
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (mounted) setCardQrUrl(url);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [cleanUsername, backApp.qrFg, backApp.qrBg, resolved.showQr]);

  // Exact font stack shared with Canvas 2D export (never var(...))
  const cardFont = getCanvasFontName(resolved.fontId, 'Inter, system-ui, sans-serif');
  const editorialItalicFont = "'Instrument Serif', 'Playfair Display', Georgia, serif";
  const initials = (displayName || cleanUsername).slice(0, 2).toUpperCase();
  const displayQrSrc = cardQrUrl || qrDataUrl;
  const footerWebsite = resolved.websiteUrl || `iveo.site/${cleanUsername}`;
  const backLinks =
    resolved.showSocialsOnBack !== false
      ? buildBackSocialLinks(socials, resolved.websiteUrl, cleanUsername)
      : [];

  const padX = 36;
  const padY = 28;
  const frontRoleLine = [resolved.role, resolved.companyOrLocation].filter(Boolean).join(' · ');

  const renderTemplateDecor = (app: ReturnType<typeof resolveFrontCardAppearance>) => (
    <>
      {app.metallicFinish && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            boxShadow: app.isLight
              ? 'inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(15,23,42,0.08)'
              : 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.45)',
            borderRadius: `${app.cornerRadius}px`,
          }}
        />
      )}

      {app.template === 'executive' && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '8px',
            backgroundColor: app.accentColor,
          }}
        />
      )}

      {app.template === 'editorial' && (
        <div
          style={{
            position: 'absolute',
            inset: '13px',
            pointerEvents: 'none',
            border: `1.25px solid ${app.accentColor}4D`,
            borderRadius: `${app.innerCornerRadius}px`,
          }}
        />
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Front / Back Toggle Control */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center p-0.5 rounded-lg bg-surface-2 border border-border">
          <button
            type="button"
            data-testid="card-side-front-btn"
            onClick={() => setActiveSide('front')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              activeSide === 'front'
                ? 'bg-surface text-ink shadow-2xs border border-border/60'
                : 'text-muted hover:text-ink'
            }`}
          >
            Front Side
          </button>
          <button
            type="button"
            data-testid="card-side-back-btn"
            onClick={() => setActiveSide('back')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              activeSide === 'back'
                ? 'bg-surface text-ink shadow-2xs border border-border/60'
                : 'text-muted hover:text-ink'
            }`}
          >
            Back Side (QR &amp; Links)
          </button>
        </div>

        <button
          type="button"
          data-testid="card-flip-btn"
          onClick={() => setActiveSide(activeSide === 'front' ? 'back' : 'front')}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-ink px-2 py-1 rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
        >
          <RotateCw size={12} />
          <span>Flip card</span>
        </button>
      </div>

      {/* 3D Two-Sided Card Container */}
      <div
        ref={containerRef}
        data-testid="business-card-preview"
        data-side={activeSide}
        className="w-full relative select-none"
        style={{
          aspectRatio: `${CARD_BASE_WIDTH} / ${CARD_BASE_HEIGHT}`,
          perspective: '1400px',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
            transform: activeSide === 'back' ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* ================= FRONT FACE ================= */}
          <div
            data-testid="business-card-front"
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              borderRadius: `${Math.round(frontApp.cornerRadius * scale)}px`,
              boxShadow: '0 14px 36px rgba(0, 0, 0, 0.22)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            <div
              style={{
                width: `${CARD_BASE_WIDTH}px`,
                height: `${CARD_BASE_HEIGHT}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: frontApp.bgColor,
                backgroundImage: frontApp.backgroundCssImage,
                color: frontApp.textColor,
                border: `1.5px solid ${frontApp.borderColor}`,
                borderRadius: `${frontApp.cornerRadius}px`,
                fontFamily: cardFont,
                padding: `${padY}px ${padX}px`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
              }}
            >
              {renderTemplateDecor(frontApp)}

              {/* Top Header Row: Top-left rounded-square Logo/Avatar + Top-right iveo mark */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px',
                  paddingLeft: frontApp.template === 'executive' ? '6px' : '0px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {resolved.showAvatar !== false &&
                    (avatarUrl && !avatarFailed ? (
                      <div
                        style={{
                          width: '54px',
                          height: '54px',
                          borderRadius: '14px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          border: `1.5px solid ${frontApp.borderColor}`,
                          backgroundColor: '#FFFFFF',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
                        }}
                      >
                        <img
                          src={avatarUrl}
                          alt={displayName || cleanUsername}
                          referrerPolicy="no-referrer"
                          onError={() => setAvatarFailed(true)}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: '54px',
                          height: '54px',
                          borderRadius: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '21px',
                          flexShrink: 0,
                          backgroundColor: frontApp.isLight ? '#0A0A0A' : '#FFFFFF',
                          color: frontApp.isLight ? '#FFFFFF' : '#0A0A0A',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                        }}
                      >
                        {initials}
                      </div>
                    ))}

                  {resolved.badgeText && (
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        backgroundColor: `${frontApp.accentColor}22`,
                        color: frontApp.accentColor,
                        border: `1px solid ${frontApp.accentColor}4D`,
                      }}
                    >
                      {resolved.badgeText}
                    </span>
                  )}
                </div>

                <span
                  style={{
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    fontSize: '14px',
                    color: frontApp.mutedColor,
                  }}
                >
                  iveo
                </span>
              </div>

              {/* Center / Lower Identity Block */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 10,
                  paddingLeft: frontApp.template === 'executive' ? '6px' : '0px',
                  marginTop: 'auto',
                  marginBottom: 'auto',
                  paddingTop: '14px',
                  paddingBottom: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <h4
                    style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      lineHeight: '1.12',
                      letterSpacing: '-0.02em',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: frontApp.textColor,
                    }}
                  >
                    {displayName || cleanUsername}
                  </h4>
                  {isPro && <VerifiedTick size={17} onDark={!frontApp.isLight} />}
                </div>

                {(frontRoleLine || resolved.showHandle !== false) && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '7px',
                      fontSize: '14px',
                      lineHeight: '1.35',
                      color: frontApp.mutedColor,
                    }}
                  >
                    {resolved.role && (
                      <span style={{ fontWeight: 500, color: frontApp.textColor }}>
                        {resolved.role}
                      </span>
                    )}
                    {resolved.role && resolved.companyOrLocation && (
                      <span style={{ opacity: 0.55 }}>·</span>
                    )}
                    {resolved.companyOrLocation && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} style={{ color: frontApp.accentColor }} />
                        <span>{resolved.companyOrLocation}</span>
                      </span>
                    )}
                    {(frontRoleLine && resolved.showHandle !== false) && (
                      <span style={{ opacity: 0.55 }}>·</span>
                    )}
                    {resolved.showHandle !== false && (
                      <span
                        style={{
                          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                          fontSize: '12.5px',
                          color: frontApp.mutedColor,
                        }}
                      >
                        @{cleanUsername}
                      </span>
                    )}
                  </div>
                )}

                {resolved.showBio !== false && bio && (
                  <p
                    className="line-clamp-2"
                    style={{
                      fontSize: '12.5px',
                      lineHeight: '18px',
                      margin: '2px 0 0 0',
                      color: frontApp.mutedColor,
                      maxWidth: '500px',
                    }}
                  >
                    {bio}
                  </p>
                )}

                {(resolved.contactEmail || resolved.contactPhone) && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      columnGap: '16px',
                      rowGap: '4px',
                      fontSize: '12px',
                      marginTop: '4px',
                      color: frontApp.textColor,
                    }}
                  >
                    {resolved.contactEmail && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Mail size={12} style={{ color: frontApp.accentColor, flexShrink: 0 }} />
                        <span>{resolved.contactEmail}</span>
                      </span>
                    )}
                    {resolved.contactPhone && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Phone size={12} style={{ color: frontApp.accentColor, flexShrink: 0 }} />
                        <span>{resolved.contactPhone}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Bar */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 10,
                  paddingLeft: frontApp.template === 'executive' ? '6px' : '0px',
                  paddingTop: '10px',
                  borderTop: `1px solid ${frontApp.borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: frontApp.textColor,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '410px',
                  }}
                >
                  {footerWebsite}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: frontApp.mutedColor,
                  }}
                >
                  FRONT
                </span>
              </div>
            </div>
          </div>

          {/* ================= BACK FACE (QR + EDITORIAL + SOCIALS) ================= */}
          <div
            data-testid="business-card-back"
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              borderRadius: `${Math.round(backApp.cornerRadius * scale)}px`,
              boxShadow: '0 14px 36px rgba(0, 0, 0, 0.16)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div
              style={{
                width: `${CARD_BASE_WIDTH}px`,
                height: `${CARD_BASE_HEIGHT}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: backApp.bgColor,
                backgroundImage: backApp.backgroundCssImage,
                color: backApp.textColor,
                border: `1.5px solid ${backApp.borderColor}`,
                borderRadius: `${backApp.cornerRadius}px`,
                fontFamily: cardFont,
                padding: '28px 34px',
                display: 'flex',
                alignItems: 'center',
                gap: '28px',
                boxSizing: 'border-box',
              }}
            >
              {renderTemplateDecor(backApp)}

              {/* Left Column: Large Scannable QR */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 10,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {resolved.showQr !== false && displayQrSrc ? (
                  <div
                    style={{
                      width: '188px',
                      height: '188px',
                      padding: '8px',
                      borderRadius: '16px',
                      backgroundColor: backApp.qrBg,
                      border: `1px solid ${backApp.borderColor}`,
                      boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <img
                      src={displayQrSrc}
                      alt={`QR code for iveo.site/${cleanUsername}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                        borderRadius: '8px',
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '164px',
                      height: '164px',
                      borderRadius: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '42px',
                      fontWeight: 700,
                      backgroundColor: backApp.accentColor,
                      color: isLightHexColor(backApp.accentColor) ? '#0A0A0A' : '#FFFFFF',
                    }}
                  >
                    {initials}
                  </div>
                )}
              </div>

              {/* Right Column: Editorial Headline + Handle + Social Links */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 10,
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '14px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '26px',
                      fontWeight: 600,
                      lineHeight: '1.1',
                      letterSpacing: '-0.02em',
                      color: backApp.textColor,
                    }}
                  >
                    {resolved.backHeadline || 'Scan to'}
                  </div>
                  <div
                    style={{
                      fontFamily: editorialItalicFont,
                      fontStyle: 'italic',
                      fontSize: '31px',
                      fontWeight: 400,
                      lineHeight: '1.1',
                      color: backApp.textColor,
                      marginTop: '1px',
                    }}
                  >
                    {resolved.backSubheadline || 'open my page.'}
                  </div>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: backApp.mutedColor,
                  }}
                >
                  <span className="truncate">iveo.site/{cleanUsername}</span>
                  {isPro && <VerifiedTick size={14} onDark={!backApp.isLight} />}
                </div>

                {/* Back Side Social Media Profile Links */}
                {backLinks.length > 0 && (
                  <div
                    data-testid="card-back-socials"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '7px',
                      paddingTop: '10px',
                      borderTop: `1px solid ${backApp.borderColor}`,
                    }}
                  >
                    {backLinks.map((item) => (
                      <div
                        key={item.platform}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '5px 8px',
                          borderRadius: '8px',
                          backgroundColor: backApp.isLight
                            ? 'rgba(15, 23, 42, 0.05)'
                            : 'rgba(255, 255, 255, 0.08)',
                          border: `1px solid ${backApp.borderColor}`,
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            color: backApp.accentColor,
                            display: 'inline-flex',
                            alignItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <SocialIcon platform={item.platform} size={13} />
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: backApp.textColor,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.valueLabel || item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
