import React, { useEffect, useRef } from 'react';

const CSS = `
  .iveo-claim{
    --ic-bg:#F5F5F5;
    --ic-surface:#FFFFFF;
    --ic-border:#E5E5E5;
    --ic-text:#0A0A0A;
    --ic-muted:#666666;
    --ic-ok:#0A0A0A;
    --ic-mono:'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

    container-type:inline-size;
    box-sizing:border-box;
    width:100%;
    aspect-ratio:322/193;
    background:var(--ic-bg);
    border:1px solid var(--ic-border);
    border-radius:10px;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:3.6cqw;
    overflow:hidden;
    position:relative;
  }
  .iveo-claim *{box-sizing:border-box}

  .iveo-claim .ic-field{
    width:74%;
    display:flex;align-items:center;justify-content:space-between;
    padding:0 4.5cqw;
    height:15cqw;
    background:var(--ic-surface);
    border:1px solid var(--ic-border);
    border-radius:3.6cqw;
    font-family:var(--ic-mono);
    font-size:5.2cqw;
    color:var(--ic-text);
    box-shadow:0 1px 2px rgba(0,0,0,.04);
    transition:box-shadow .3s, border-color .3s;
  }
  .iveo-claim.is-typing .ic-field{
    border-color:#c9c9c9;
    box-shadow:0 0 0 1.2cqw rgba(0,0,0,.05);
  }
  .iveo-claim.is-done .ic-field{animation:ic-pop .45s ease}

  .iveo-claim .ic-text{white-space:nowrap;display:flex;align-items:center}
  .iveo-claim .ic-caret{width:1px;height:1.2em;margin-left:1px;background:var(--ic-text);opacity:0}
  .iveo-claim.is-typing .ic-caret{opacity:1;animation:ic-blink 1s steps(1) infinite}

  .iveo-claim .ic-status{width:5.6cqw;height:5.6cqw;position:relative;flex:none}
  .iveo-claim .ic-status svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
  .iveo-claim .ic-spin{opacity:0;transform-origin:50% 50%}
  .iveo-claim.is-checking .ic-spin{opacity:1;animation:ic-rot .7s linear infinite}
  .iveo-claim .ic-check path{
    stroke-dasharray:20;stroke-dashoffset:20;
    transition:stroke-dashoffset .4s cubic-bezier(.65,0,.35,1);
  }
  .iveo-claim.is-done .ic-check path{stroke-dashoffset:0}

  .iveo-claim .ic-label{
    font-size:4cqw;
    color:var(--ic-muted);
    height:1.4em;line-height:1.4em;
    opacity:0;transform:translateY(1cqw);
    transition:opacity .35s, transform .35s;
  }
  .iveo-claim.is-checking .ic-label,
  .iveo-claim.is-done .ic-label{opacity:1;transform:none}

  @keyframes ic-blink{50%{opacity:0}}
  @keyframes ic-rot{to{transform:rotate(360deg)}}
  @keyframes ic-pop{0%{transform:scale(1)}40%{transform:scale(1.035)}100%{transform:scale(1)}}

  @media (prefers-reduced-motion:reduce){
    .iveo-claim *{animation:none!important;transition:none!important}
  }
`;

export const ClaimNameAnimation: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const nameEl = nameRef.current;
    const label = labelRef.current;
    if (!root || !nameEl || !label) return;

    const names = ['maya', 'lena', 'devsharma'];
    let i = 0;
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

    function setState(c: string) {
      if (!root) return;
      root.className = 'iveo-claim' + (c ? ' ' + c : '');
    }

    async function type(txt: string) {
      if (!nameEl) return;
      for (let k = 1; k <= txt.length && running && !destroyed; k++) {
        nameEl.textContent = txt.slice(0, k);
        await wait(110 + Math.random() * 70);
      }
    }

    async function erase() {
      if (!nameEl) return;
      while (nameEl.textContent && nameEl.textContent.length > 0 && running && !destroyed) {
        nameEl.textContent = nameEl.textContent.slice(0, -1);
        await wait(45);
      }
    }

    async function loop() {
      if (running || destroyed || document.hidden) return;
      running = true;
      while (running && !destroyed) {
        const n = names[i++ % names.length];
        nameEl!.textContent = '';
        setState('');
        await wait(500);
        if (!running || destroyed) break;
        setState('is-typing');
        await type(n);
        if (!running || destroyed) break;
        await wait(250);
        if (!running || destroyed) break;
        setState('is-checking');
        label!.textContent = 'Checking…';
        await wait(900);
        if (!running || destroyed) break;
        setState('is-done');
        label!.textContent = 'Available';
        await wait(2200);
        if (!running || destroyed) break;
        setState('is-typing');
        await erase();
        if (!running || destroyed) break;
        await wait(250);
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
      nameEl.textContent = names[0];
      label.textContent = 'Available';
      setState('is-done');
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
        className="iveo-claim"
        role="img"
        aria-label="Typing a username and seeing that it is available on iveo"
      >
        <div className="ic-field">
          <span className="ic-text">
            <span>iveo.site/</span>
            <span ref={nameRef} className="ic-name" />
            <span className="ic-caret" />
          </span>
          <span className="ic-status" aria-hidden="true">
            <svg
              className="ic-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#bbb"
              strokeWidth={2.4}
              strokeLinecap="round"
            >
              <path d="M12 3a9 9 0 1 0 9 9" />
            </svg>
            <svg
              className="ic-check"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ic-ok)"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
          </span>
        </div>
        <div ref={labelRef} className="ic-label">
          Checking…
        </div>
      </div>
    </>
  );
};
