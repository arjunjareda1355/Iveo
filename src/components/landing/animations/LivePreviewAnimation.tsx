import React, { useEffect, useId, useRef } from 'react';

const CSS = `
  .iveo-live{
    --ip-card:#FFFFFF;
    --ip-frame:#0A0A0A;
    --ip-mono:'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

    container-type:inline-size;
    box-sizing:border-box;
    width:100%;
    aspect-ratio:232/150;
    position:relative;
    overflow:hidden;
  }
  .iveo-live *{box-sizing:border-box}

  .iveo-live .ip-phone{
    position:absolute;left:10cqw;top:6cqw;width:80cqw;height:140cqw;
    border:1.2cqw solid var(--ip-frame);border-radius:12cqw 12cqw 0 0;
    background:#fff;overflow:hidden;
    box-shadow:0 4cqw 10cqw rgba(0,0,0,.08);
  }
  .iveo-live .ip-screen{
    --bg:#fff;--fg:#111;--muted:#777;--btn-bg:#fff;--btn-bd:#111;--btn-sh:#111;
    position:absolute;inset:0;background:var(--bg);color:var(--fg);
    display:flex;flex-direction:column;align-items:center;
    transition:background .6s, color .6s;
  }
  .iveo-live .ip-screen.is-dark{
    --bg:#121212;--fg:#f2f2f2;--muted:#9a9a9a;--btn-bg:#1d1d1d;--btn-bd:#3a3a3a;--btn-sh:#000;
  }

  .iveo-live .ip-status{
    width:100%;height:7cqw;display:flex;align-items:center;justify-content:space-between;
    padding:1.6cqw 6cqw 0 6cqw;font-size:2.7cqw;font-weight:600;position:relative;
  }
  .iveo-live .ip-notch{
    position:absolute;left:50%;top:1.6cqw;width:17cqw;height:4.4cqw;margin-left:-8.5cqw;
    background:#000;border-radius:3cqw;
  }
  .iveo-live .ip-icons{display:flex;align-items:center;gap:.9cqw}
  .iveo-live .ip-bars{display:flex;align-items:flex-end;gap:.35cqw;height:2.2cqw}
  .iveo-live .ip-bars i{display:block;width:.5cqw;background:currentColor;border-radius:.2cqw}
  .iveo-live .ip-bars i:nth-child(1){height:.8cqw}.iveo-live .ip-bars i:nth-child(2){height:1.2cqw}
  .iveo-live .ip-bars i:nth-child(3){height:1.7cqw}.iveo-live .ip-bars i:nth-child(4){height:2.2cqw}
  .iveo-live .ip-batt{width:4.2cqw;height:2.1cqw;border:1px solid currentColor;border-radius:.7cqw;position:relative;opacity:.9}
  .iveo-live .ip-batt::after{content:"";position:absolute;inset:.25cqw;background:currentColor;border-radius:.3cqw}

  .iveo-live .ip-content{width:100%;display:flex;flex-direction:column;align-items:center;transition:opacity .5s}
  .iveo-live .ip-content.is-out{opacity:0}
  .iveo-live .ip-av{
    width:11cqw;height:11cqw;border-radius:50%;margin-top:3.2cqw;overflow:hidden;
    background:#ddd;flex:none;
    opacity:0;transform:scale(.7);transition:opacity .4s, transform .5s cubic-bezier(.2,.9,.3,1.3);
  }
  .iveo-live .ip-av img,.iveo-live .ip-av svg{display:block;width:100%;height:100%;object-fit:cover}
  .iveo-live.has-av .ip-av{opacity:1;transform:none}

  .iveo-live .ip-name{
    margin-top:2.2cqw;height:5.4cqw;font-size:4.2cqw;font-weight:600;letter-spacing:-.01em;
    display:flex;align-items:center;white-space:nowrap;
  }
  .iveo-live .ip-caret{width:1px;height:1.1em;margin-left:1px;background:currentColor;opacity:0}
  .iveo-live.is-typing .ip-caret{opacity:1;animation:ip-blink 1s steps(1) infinite}
  .iveo-live .ip-handle{
    font-family:var(--ip-mono);font-size:2.7cqw;color:var(--muted);margin-top:.4cqw;
    opacity:0;transform:translateY(1cqw);transition:opacity .4s, transform .4s;
  }
  .iveo-live .ip-bio{
    font-size:3cqw;color:var(--muted);margin-top:1.4cqw;
    opacity:0;transform:translateY(1cqw);transition:opacity .4s .1s, transform .4s .1s;
  }
  .iveo-live .ip-links{width:100%;padding:0 7cqw;margin-top:4cqw;display:flex;flex-direction:column;gap:2.6cqw}
  .iveo-live .ip-btn{
    height:7.4cqw;border:1px solid var(--btn-bd);border-radius:2.4cqw;background:var(--btn-bg);
    display:flex;align-items:center;justify-content:center;font-size:3.2cqw;font-weight:500;
    box-shadow:.5cqw .7cqw 0 var(--btn-sh);
    opacity:0;transform:translateY(3cqw);
    transition:opacity .45s, transform .5s cubic-bezier(.2,.9,.3,1), background .6s, border-color .6s, box-shadow .6s;
  }
  .iveo-live.show-handle .ip-handle,.iveo-live.show-bio .ip-bio{opacity:1;transform:none}
  .iveo-live.show-b1 .ip-btn:nth-child(1),
  .iveo-live.show-b2 .ip-btn:nth-child(2){opacity:1;transform:none}

  .iveo-live .ip-chip{
    position:absolute;right:1.5cqw;top:1.5cqw;z-index:4;
    display:flex;align-items:center;gap:1.4cqw;
    padding:1.5cqw 3cqw;background:#fff;border:1px solid #e4e4e4;border-radius:3cqw;
    font-size:2.8cqw;color:#111;box-shadow:0 .6cqw 2cqw rgba(0,0,0,.08);
    opacity:0;transform:translateY(-1.5cqw) scale(.96);
    transition:opacity .3s, transform .3s;
  }
  .iveo-live .ip-chip::before{content:"";width:1.4cqw;height:1.4cqw;border-radius:50%;background:#22a55a}
  .iveo-live.chip-on .ip-chip{opacity:1;transform:none}

  .iveo-live .ip-fade{
    position:absolute;left:0;right:0;bottom:0;height:16cqw;z-index:3;pointer-events:none;
    background:linear-gradient(to bottom, rgba(255,255,255,0), var(--ip-card));
  }

  @keyframes ip-blink{50%{opacity:0}}
  @media (prefers-reduced-motion:reduce){
    .iveo-live *{animation:none!important;transition:none!important}
  }
`;

export const LivePreviewAnimation: React.FC = () => {
  const gradId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const screen = screenRef.current;
    const content = contentRef.current;
    const textEl = textRef.current;
    if (!root || !screen || !content || !textEl) return;

    const FULL = 'Maya Ellis';
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

    function on(c: string) {
      root?.classList.add(c);
    }

    function off(c: string) {
      root?.classList.remove(c);
    }

    async function pulse() {
      on('chip-on');
      await wait(1100);
      if (!running || destroyed) return;
      off('chip-on');
      await wait(200);
    }

    function reset() {
      ['has-av', 'is-typing', 'show-handle', 'show-bio', 'show-b1', 'show-b2', 'chip-on'].forEach(
        off
      );
      screen!.classList.remove('is-dark');
      textEl!.textContent = '';
      content!.classList.remove('is-out');
    }

    async function loop() {
      if (running || destroyed || document.hidden) return;
      running = true;
      while (running && !destroyed) {
        reset();
        await wait(700);
        if (!running || destroyed) break;
        on('has-av');
        await wait(600);
        if (!running || destroyed) break;
        void pulse();
        on('is-typing');
        for (let k = 1; k <= FULL.length && running && !destroyed; k++) {
          textEl!.textContent = FULL.slice(0, k);
          await wait(95 + Math.random() * 50);
        }
        if (!running || destroyed) break;
        off('is-typing');
        await wait(200);
        if (!running || destroyed) break;
        await pulse();
        if (!running || destroyed) break;
        on('show-handle');
        on('show-bio');
        await wait(700);
        if (!running || destroyed) break;
        await pulse();
        if (!running || destroyed) break;
        on('show-b1');
        await wait(500);
        if (!running || destroyed) break;
        await pulse();
        if (!running || destroyed) break;
        on('show-b2');
        await wait(500);
        if (!running || destroyed) break;
        await pulse();
        if (!running || destroyed) break;
        await wait(600);
        if (!running || destroyed) break;
        screen!.classList.add('is-dark');
        await wait(700);
        if (!running || destroyed) break;
        await pulse();
        if (!running || destroyed) break;
        await wait(1500);
        if (!running || destroyed) break;
        screen!.classList.remove('is-dark');
        await wait(900);
        if (!running || destroyed) break;
        await wait(900);
        if (!running || destroyed) break;
        content!.classList.add('is-out');
        await wait(700);
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
      ['has-av', 'show-handle', 'show-bio', 'show-b1', 'show-b2'].forEach(on);
      textEl.textContent = FULL;
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
        className="iveo-live"
        role="img"
        aria-label="A phone preview that updates live as the page is edited"
      >
        <div className="ip-chip">Updated just now</div>
        <div className="ip-phone">
          <div ref={screenRef} className="ip-screen">
            <div className="ip-status">
              <span>9:41</span>
              <span className="ip-notch" />
              <span className="ip-icons">
                <span className="ip-bars">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span className="ip-batt" />
              </span>
            </div>
            <div ref={contentRef} className="ip-content">
              <div className="ip-av">
                <svg viewBox="0 0 40 40" aria-hidden="true">
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#8a8fb8" />
                      <stop offset="1" stopColor="#2d2f4a" />
                    </linearGradient>
                  </defs>
                  <rect width="40" height="40" fill={`url(#${gradId})`} />
                  <circle cx="20" cy="16" r="7" fill="#f2e3d5" />
                  <path d="M6 40c1-9 7-14 14-14s13 5 14 14z" fill="#f2e3d5" />
                </svg>
              </div>
              <div className="ip-name">
                <span ref={textRef} className="ip-text" />
                <span className="ip-caret" />
              </div>
              <div className="ip-handle">@mayaellis</div>
              <div className="ip-bio">Illustrator and zine maker.</div>
              <div className="ip-links">
                <div className="ip-btn">Portfolio</div>
                <div className="ip-btn">Shop prints</div>
              </div>
            </div>
          </div>
        </div>
        <div className="ip-fade" />
      </div>
    </>
  );
};
