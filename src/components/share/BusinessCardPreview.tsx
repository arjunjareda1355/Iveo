import React, { useEffect, useRef, useState } from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import {
  BusinessCardConfig,
  CARD_BASE_HEIGHT,
  CARD_BASE_WIDTH,
  DEFAULT_BUSINESS_CARD_CONFIG,
  parseBusinessCardConfig,
  resolveBusinessCardAppearance,
} from '../../lib/businessCardConfig';
import { getCanvasFontName, loadGoogleFonts } from '../../lib/fonts';
import { isLightHexColor } from '../../lib/colors';
import { makeQrPngDataUrl } from '../../lib/qr';
import { VerifiedTick } from '../ui/VerifiedTick';

export interface BusinessCardPreviewProps {
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  isPro?: boolean;
  qrDataUrl?: string | null;
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
  isPro = false,
  qrDataUrl,
  vibeTheme,
  config,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.66);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [cardQrUrl, setCardQrUrl] = useState<string | null>(null);

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
    if (resolved.fontId) {
      loadGoogleFonts([resolved.fontId]);
    }
  }, [resolved.fontId]);

  const cleanUsername = (username || 'creator').toLowerCase().trim();
  const app = resolveBusinessCardAppearance(resolved, vibeTheme);

  useEffect(() => {
    if (resolved.showQr === false) return;
    let mounted = true;
    const targetUrl = `https://iveo.site/${cleanUsername}?src=qr`;
    makeQrPngDataUrl(targetUrl, {
      darkColor: app.qrFg,
      lightColor: app.qrBg,
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
  }, [cleanUsername, app.qrFg, app.qrBg, resolved.showQr]);

  // Exact font stack shared with Canvas 2D export (never var(...))
  const cardFont = getCanvasFontName(resolved.fontId, 'Inter, system-ui, sans-serif');
  const initials = (displayName || cleanUsername).slice(0, 2).toUpperCase();
  const displayQrSrc = cardQrUrl || qrDataUrl;
  const footerWebsite = resolved.websiteUrl || `iveo.site/${cleanUsername}`;

  const padX = 34;
  const padY = 30;

  return (
    <div
      ref={containerRef}
      data-testid="business-card-preview"
      className="w-full relative overflow-hidden select-none shadow-md"
      style={{
        aspectRatio: `${CARD_BASE_WIDTH} / ${CARD_BASE_HEIGHT}`,
        borderRadius: `${Math.round(app.cornerRadius * scale)}px`,
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
          backgroundColor: app.bgColor,
          backgroundImage: app.backgroundCssImage,
          color: app.textColor,
          border: `1.5px solid ${app.borderColor}`,
          borderRadius: `${app.cornerRadius}px`,
          fontFamily: cardFont,
          padding: `${padY}px ${padX}px`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
        }}
      >
        {/* Template decorative layers */}
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

        {app.template === 'classic' && !app.bgColor2 && (
          <div
            style={{
              position: 'absolute',
              width: '220px',
              height: '220px',
              borderRadius: '9999px',
              backgroundColor: app.accentColor,
              opacity: app.isLight ? 0.09 : 0.17,
              pointerEvents: 'none',
              ...(app.isLight
                ? { left: '-62px', bottom: '-76px' }
                : { right: '-52px', top: '-68px' }),
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

        {/* Top Row: Identity + Badge + QR */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            paddingLeft: app.template === 'executive' ? '4px' : '0px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', minWidth: 0, flex: 1 }}>
            {resolved.showAvatar !== false &&
              (avatarUrl && !avatarFailed ? (
                <img
                  src={avatarUrl}
                  alt={displayName || cleanUsername}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  style={{
                    width: '62px',
                    height: '62px',
                    borderRadius: '9999px',
                    objectFit: 'cover',
                    flexShrink: 0,
                    border: `2.5px solid ${app.accentColor}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '62px',
                    height: '62px',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '23px',
                    flexShrink: 0,
                    backgroundColor: app.accentColor,
                    color: isLightHexColor(app.accentColor) ? '#0A0A0A' : '#FFFFFF',
                    border: `2px solid ${app.borderColor}`,
                  }}
                >
                  {initials}
                </div>
              ))}

            <div style={{ minWidth: 0, flex: 1 }}>
              {resolved.badgeText && (
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    padding: '3px 9px',
                    borderRadius: '9999px',
                    marginBottom: '6px',
                    lineHeight: '1.1',
                    backgroundColor: `${app.accentColor}24`,
                    color: app.accentColor,
                    border: `1px solid ${app.accentColor}4D`,
                  }}
                >
                  {resolved.badgeText}
                </span>
              )}
              <h4
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  lineHeight: '1.15',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: app.textColor,
                }}
              >
                {displayName || cleanUsername}
              </h4>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  columnGap: '6px',
                  rowGap: '2px',
                  fontSize: '12px',
                  lineHeight: '1.35',
                  marginTop: '4px',
                }}
              >
                {resolved.role && (
                  <span style={{ fontWeight: 600, color: app.accentColor }}>
                    {resolved.role}
                  </span>
                )}
                {resolved.role && resolved.showHandle !== false && (
                  <span style={{ color: app.mutedColor }}>·</span>
                )}
                {resolved.showHandle !== false && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                      color: app.mutedColor,
                    }}
                  >
                    <span>@{cleanUsername}</span>
                    {isPro && <VerifiedTick size={13} onDark={!app.isLight} />}
                  </span>
                )}
                {resolved.companyOrLocation && (
                  <>
                    {(resolved.role || resolved.showHandle !== false) && (
                      <span style={{ color: app.mutedColor }}>·</span>
                    )}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        color: app.mutedColor,
                      }}
                    >
                      <MapPin size={11} />
                      <span>{resolved.companyOrLocation}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {resolved.showQr !== false && displayQrSrc && (
            <div
              style={{
                width: '72px',
                height: '72px',
                padding: '5px',
                borderRadius: '10px',
                flexShrink: 0,
                backgroundColor: app.qrBg,
                border: '1px solid rgba(0, 0, 0, 0.1)',
                boxSizing: 'border-box',
              }}
            >
              <img
                src={displayQrSrc}
                alt="QR code"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  borderRadius: '4px',
                }}
              />
            </div>
          )}
        </div>

        {/* Middle Row: Bio & Contact Chips */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            paddingLeft: app.template === 'executive' ? '4px' : '0px',
            marginTop: 'auto',
            marginBottom: 'auto',
            paddingTop: '10px',
            paddingBottom: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {resolved.showBio !== false && bio && (
            <p
              className="line-clamp-2"
              style={{
                fontSize: '13px',
                lineHeight: '19px',
                margin: 0,
                color: app.mutedColor,
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
                columnGap: '14px',
                rowGap: '4px',
                fontSize: '11.5px',
                lineHeight: '16px',
                color: app.textColor,
              }}
            >
              {resolved.contactEmail && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Mail size={11.5} style={{ color: app.accentColor, flexShrink: 0 }} />
                  <span>{resolved.contactEmail}</span>
                </span>
              )}
              {resolved.contactPhone && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Phone size={11.5} style={{ color: app.accentColor, flexShrink: 0 }} />
                  <span>{resolved.contactPhone}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bottom Footer Bar */}
        <div
          style={{
            paddingTop: '12px',
            borderTop: `1px solid ${app.borderColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            position: 'relative',
            zIndex: 10,
            paddingLeft: app.template === 'executive' ? '4px' : '0px',
          }}
        >
          <span
            style={{
              fontWeight: 700,
              letterSpacing: '-0.02em',
              fontSize: '13.5px',
              color: app.textColor,
            }}
          >
            iveo
          </span>
          <span
            style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: '11.5px',
              color: app.mutedColor,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '420px',
            }}
          >
            {footerWebsite}
          </span>
        </div>
      </div>
    </div>
  );
};
