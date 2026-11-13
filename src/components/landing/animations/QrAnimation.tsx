import React, { useEffect, useMemo, useRef } from 'react';

const CSS = `
  .iveo-qr{
    --iq-bg:#F5F5F5;
    --iq-card:#FFFFFF;
    --iq-ink:#0A0A0A;
    --iq-mono:'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

    container-type:inline-size;
    box-sizing:border-box;
    width:100%;
    aspect-ratio:232/109;
    background:var(--iq-bg);
    border:1px solid #E5E5E5;
    border-radius:10px;
    overflow:hidden;
    position:relative;
    display:flex;align-items:center;justify-content:center;
  }
  .iveo-qr *{box-sizing:border-box}

  .iveo-qr .iq-card{
    width:37cqw;aspect-ratio:1;padding:3.4cqw;position:relative;overflow:hidden;
    background:var(--iq-card);border:1px solid #E5E5E5;border-radius:3.4cqw;
    box-shadow:0 .6cqw 2.4cqw rgba(0,0,0,.06);
  }
  .iveo-qr .iq-card.is-pulse{animation:iq-pulse .5s ease}
  .iveo-qr svg.iq-code{display:block;width:100%;height:100%}
  .iveo-qr .iq-code rect{
    fill:var(--iq-ink);
    transform-box:fill-box;transform-origin:center;transform:scale(0);
    transition:transform .3s cubic-bezier(.2,.9,.3,1.3);
  }
  .iveo-qr.is-built .iq-code rect{transform:scale(1);transition-delay:var(--d,0s)}

  .iveo-qr .iq-scan{
    position:absolute;left:0;right:0;top:0;height:7cqw;pointer-events:none;opacity:0;
    background:linear-gradient(to bottom, rgba(17,17,17,0), rgba(17,17,17,.14) 60%, rgba(17,17,17,.55) 98%, rgba(17,17,17,.55));
    border-bottom:1px solid rgba(17,17,17,.55);
    transform:translateY(-100%);
  }
  .iveo-qr.is-scanning .iq-scan{animation:iq-scan 1.3s cubic-bezier(.5,0,.3,1) forwards}

  .iveo-qr .iq-pill{
    position:absolute;right:6cqw;bottom:5cqw;z-index:3;
    display:flex;align-items:center;gap:1.6cqw;
    height:7.4cqw;padding:0 3.2cqw;border-radius:4cqw;
    background:#111;color:#fff;font-family:var(--iq-mono);font-size:2.9cqw;
    box-shadow:0 1cqw 3cqw rgba(0,0,0,.2);
    opacity:0;transform:translateY(3cqw) scale(.95);
    transition:opacity .35s, transform .45s cubic-bezier(.2,.9,.3,1.2);
  }
  .iveo-qr.show-pill .iq-pill{opacity:1;transform:none}
  .iveo-qr .iq-pill svg{width:3.4cqw;height:3.4cqw}
  .iveo-qr .iq-pill .iq-done{display:none}
  .iveo-qr.is-saved .iq-pill .iq-dl{display:none}
  .iveo-qr.is-saved .iq-pill .iq-done{display:block}
  .iveo-qr.is-saving .iq-pill .iq-dl{animation:iq-bob .5s ease 2}
  .iveo-qr .iq-pill .iq-t2{display:none}
  .iveo-qr.is-saved .iq-pill .iq-t1{display:none}
  .iveo-qr.is-saved .iq-pill .iq-t2{display:inline}

  .iveo-qr.is-out .iq-card, .iveo-qr.is-out .iq-pill{opacity:0;transition:opacity .45s}

  @keyframes iq-scan{
    0%{transform:translateY(-100%);opacity:0}
    12%{opacity:1}
    88%{opacity:1}
    100%{transform:translateY(calc(37cqw - 6.8cqw + 7cqw - 7cqw));opacity:0}
  }
  @keyframes iq-pulse{0%{transform:scale(1)}45%{transform:scale(1.045)}100%{transform:scale(1)}}
  @keyframes iq-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(.7cqw)}}
  @media (prefers-reduced-motion:reduce){
    .iveo-qr *{animation:none!important;transition:none!important}
  }
`;

export const QrAnimation: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const rects = useMemo(() => {
    const N = 21;
    let seed = 7;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const inFinderZone = (x: number, y: number) =>
      (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);

    const out: Array<{ x: number; y: number; delay: number }> = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let dark = false;
        let delay: number;
        if (inFinderZone(x, y)) {
          const fx = x > 12 ? x - 14 : x;
          const fy = y > 12 ? y - 14 : y;
          if (fx < 7 && fy < 7) {
            const a = Math.max(Math.abs(fx - 3), Math.abs(fy - 3));
            dark = a === 3 || a <= 1;
          }
          delay = (fx + fy) * 28;
        } else if (x === 6 || y === 6) {
          dark = (x + y) % 2 === 0;
          delay = 300 + rnd() * 500;
        } else {
          dark = rnd() > 0.52;
          delay = 350 + rnd() * 1000;
        }
        if (dark) {
          out.push({ x, y, delay: Math.round(delay) });
        }
      }
    }
    return out;
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const card = cardRef.current;
    if (!root || !card) return;

    let running = false;
    let destroyed = false;
    let inView = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let resolvePending: (() => void) | null = null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function wait(ms: number) {
      return new Promise<void>((resolve) => {
        if (!running || destroyed) {
          resolve();
          return;
        }
        resolvePending = resolve;
        timer = setTimeout(() => {
          resolvePending = null;
          resolve();
        }, ms);
      });
    }

    function reset() {
      ['is-built', 'is-scanning', 'show-pill', 'is-saving', 'is-saved', 'is-out'].forEach((c) =>
        root!.classList.remove(c)
      );
      card!.classList.remove('is-pulse');
    }

    async function loop() {
      if (running || destroyed || document.hidden) return;
      running = true;
      while (running && !destroyed) {
        reset();
        await wait(700);
        if (!running || destroyed) break;
        root!.classList.add('is-built');
        await wait(1900);
        if (!running || destroyed) break;
        root!.classList.add('is-scanning');
        await wait(1400);
        if (!running || destroyed) break;
        card!.classList.add('is-pulse');
        root!.classList.add('show-pill');
        await wait(900);
        if (!running || destroyed) break;
        root!.classList.add('is-saving');
        await wait(1100);
        if (!running || destroyed) break;
        root!.classList.remove('is-saving');
        root!.classList.add('is-saved');
        await wait(2200);
        if (!running || destroyed) break;
        root!.classList.add('is-out');
        await wait(800);
      }
      running = false;
    }

    function stop() {
      running = false;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (resolvePending) {
        const fn = resolvePending;
        resolvePending = null;
        fn();
      }
    }

    if (reduce) {
      root.classList.add('is-built', 'show-pill');
      return;
    }

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else if (inView) {
        void loop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    let observer: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          inView = Boolean(entries[0]?.isIntersecting);
          if (inView && !document.hidden) {
            void loop();
          } else {
            stop();
          }
        },
        { threshold: 0.35 }
      );
      observer.observe(root);
    } else {
      inView = true;
      void loop();
    }

    return () => {
      destroyed = true;
      stop();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <div
        ref={rootRef}
        className="iveo-qr"
        role="img"
        aria-label="A QR code being generated, then downloaded as a PNG"
      >
        <div ref={cardRef} className="iq-card">
          <svg
            className="iq-code"
            viewBox="0 0 21 21"
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            {rects.map((r) => (
              <rect
                key={`${r.x}-${r.y}`}
                x={r.x}
                y={r.y}
                width={1.02}
                height={1.02}
                style={{ '--d': `${r.delay}ms` } as React.CSSProperties}
              />
            ))}
          </svg>
          <span className="iq-scan" />
        </div>
        <div className="iq-pill">
          <svg
            className="iq-dl"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
          </svg>
          <svg
            className="iq-done"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
          <span className="iq-t1">PNG</span>
          <span className="iq-t2">Saved</span>
        </div>
      </div>
    </>
  );
};
