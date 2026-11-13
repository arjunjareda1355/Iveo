import React, { useEffect, useRef } from 'react';

const CSS = `
  .iveo-collect{
    --ic-bg:#F5F5F5;
    --ic-surface:#FFFFFF;
    --ic-border:#E5E5E5;
    --ic-ink:#0A0A0A;
    --ic-muted:#8F8F8F;
    --ic-mono:'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

    container-type:inline-size;
    box-sizing:border-box;
    width:100%;
    aspect-ratio:232/95;
    background:var(--ic-bg);
    border:1px solid var(--ic-border);
    border-radius:10px;
    overflow:hidden;
    position:relative;
  }
  .iveo-collect *{box-sizing:border-box}

  .iveo-collect .ice-scene{position:absolute;inset:0;transition:opacity .45s, transform .5s cubic-bezier(.2,.9,.3,1)}
  .iveo-collect .ice-list{opacity:0;transform:translateY(2cqw);pointer-events:none}
  .iveo-collect.show-list .ice-form{opacity:0;transform:translateY(-2cqw)}
  .iveo-collect.show-list .ice-list{opacity:1;transform:none}

  .iveo-collect .ice-field{
    position:absolute;left:5cqw;right:5cqw;top:7cqw;height:14cqw;
    display:flex;align-items:center;padding:0 4cqw;
    background:var(--ic-surface);border:1px solid var(--ic-border);border-radius:2.6cqw;
    font-size:3.6cqw;color:var(--ic-ink);
    transition:border-color .25s, box-shadow .25s;
  }
  .iveo-collect .ice-field.is-focus{border-color:#bdbdbd;box-shadow:0 0 0 1.1cqw rgba(0,0,0,.05)}
  .iveo-collect .ice-ph{color:var(--ic-muted);position:absolute;left:4cqw}
  .iveo-collect .ice-field:not(.is-empty) .ice-ph{display:none}
  .iveo-collect .ice-caret{width:1px;height:1.2em;margin-left:1px;background:var(--ic-ink);opacity:0}
  .iveo-collect .ice-field.is-focus .ice-caret{opacity:1;animation:ice-blink 1s steps(1) infinite}

  .iveo-collect .ice-btn{
    position:absolute;left:5cqw;right:5cqw;top:25cqw;height:12.5cqw;
    display:flex;align-items:center;justify-content:center;gap:1.8cqw;
    background:var(--ic-ink);color:#fff;border-radius:2.4cqw;font-size:3.6cqw;font-weight:600;
    transition:transform .15s;
  }
  .iveo-collect .ice-btn.is-press{transform:scale(.97)}
  .iveo-collect .ice-btn svg{width:4cqw;height:4cqw;display:none}
  .iveo-collect .ice-btn.is-loading .ice-spin{display:block;animation:ice-rot .7s linear infinite}
  .iveo-collect .ice-btn.is-loading .ice-lbl{display:none}
  .iveo-collect .ice-btn.is-done .ice-ok{display:block}

  .iveo-collect .ice-head{
    position:absolute;left:5cqw;right:5cqw;top:4.5cqw;height:6.4cqw;
    display:flex;align-items:center;justify-content:space-between;
    font-family:var(--ic-mono);font-size:2.7cqw;color:#7a7a7a;
  }
  .iveo-collect .ice-exp{
    display:flex;align-items:center;gap:1.4cqw;height:6.4cqw;padding:0 2.8cqw;border-radius:3.4cqw;
    background:var(--ic-ink);color:#fff;font-family:var(--ic-mono);font-size:2.6cqw;transition:transform .15s;
  }
  .iveo-collect .ice-exp svg{width:3cqw;height:3cqw}
  .iveo-collect .ice-exp .ice-ok2{display:none}
  .iveo-collect .ice-exp.is-press{transform:scale(.93)}
  .iveo-collect .ice-exp.is-saving .ice-dl{animation:ice-bob .5s ease 2}
  .iveo-collect .ice-exp.is-saved .ice-dl{display:none}
  .iveo-collect .ice-exp.is-saved .ice-ok2{display:block}

  .iveo-collect .ice-rows{position:absolute;left:5cqw;right:5cqw;top:13cqw;display:flex;flex-direction:column;gap:1.8cqw}
  .iveo-collect .ice-r{
    height:7.2cqw;display:flex;align-items:center;justify-content:space-between;padding:0 3.4cqw;
    background:var(--ic-surface);border:1px solid var(--ic-border);border-radius:2cqw;
    font-family:var(--ic-mono);font-size:2.8cqw;color:var(--ic-ink);
  }
  .iveo-collect .ice-r em{font-style:normal;color:var(--ic-muted);font-size:2.4cqw}
  .iveo-collect .ice-r.is-new{
    border-color:var(--ic-ink);
    max-height:0;opacity:0;margin-bottom:-1.8cqw;transform:translateY(-3cqw);
    transition:opacity .5s, transform .55s cubic-bezier(.2,.9,.3,1), max-height .5s, margin .5s;
  }
  .iveo-collect.show-new .ice-r.is-new{max-height:7.2cqw;opacity:1;margin-bottom:0;transform:none}

  .iveo-collect .ice-cursor{
    position:absolute;left:0;top:0;width:5cqw;height:5cqw;z-index:5;pointer-events:none;
    transform:translate(var(--cx,96cqw),var(--cy,42cqw));
    transition:transform .8s cubic-bezier(.4,0,.2,1), opacity .3s;
    opacity:0;filter:drop-shadow(0 .3cqw .5cqw rgba(0,0,0,.25));
  }
  .iveo-collect .ice-cursor.is-on{opacity:1}
  .iveo-collect.is-out .ice-scene{opacity:0}

  @keyframes ice-blink{50%{opacity:0}}
  @keyframes ice-rot{to{transform:rotate(360deg)}}
  @keyframes ice-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(.5cqw)}}
  @media (prefers-reduced-motion:reduce){
    .iveo-collect *{animation:none!important;transition:none!important}
  }
`;

export const CollectAnimation: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const lblRef = useRef<HTMLSpanElement>(null);
  const expRef = useRef<HTMLSpanElement>(null);
  const expTRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const field = fieldRef.current;
    const text = textRef.current;
    const btn = btnRef.current;
    const lbl = lblRef.current;
    const exp = expRef.current;
    const expT = expTRef.current;
    const cursor = cursorRef.current;
    if (!root || !field || !text || !btn || !lbl || !exp || !expT || !cursor) return;

    const EMAIL = 'hello@maya.com';
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

    function aim(el: HTMLElement, fx = 0.5, fy = 0.5) {
      const rr = root!.getBoundingClientRect();
      const cr = el.getBoundingClientRect();
      const u = rr.width / 100;
      if (u <= 0) return;
      cursor!.style.setProperty('--cx', `${(cr.left - rr.left + cr.width * fx) / u - 1}cqw`);
      cursor!.style.setProperty('--cy', `${(cr.top - rr.top + cr.height * fy) / u - 0.7}cqw`);
    }

    async function press(el: HTMLElement) {
      el.classList.add('is-press');
      await wait(150);
      if (!running || destroyed) return;
      el.classList.remove('is-press');
    }

    function reset() {
      ['show-list', 'show-new', 'is-out'].forEach((c) => root!.classList.remove(c));
      text!.textContent = '';
      field!.classList.add('is-empty');
      field!.classList.remove('is-focus');
      btn!.classList.remove('is-loading', 'is-done');
      lbl!.textContent = 'Subscribe';
      exp!.classList.remove('is-saving', 'is-saved');
      expT!.textContent = 'Export CSV';
      cursor!.classList.remove('is-on');
      cursor!.style.setProperty('--cx', '96cqw');
      cursor!.style.setProperty('--cy', '42cqw');
    }

    async function loop() {
      if (running || destroyed || document.hidden) return;
      running = true;
      while (running && !destroyed) {
        reset();
        await wait(800);
        if (!running || destroyed) break;
        field!.classList.add('is-focus');
        field!.classList.remove('is-empty');
        await wait(350);
        for (let k = 1; k <= EMAIL.length && running && !destroyed; k++) {
          text!.textContent = EMAIL.slice(0, k);
          await wait(70 + Math.random() * 40);
        }
        if (!running || destroyed) break;
        await wait(500);
        if (!running || destroyed) break;
        field!.classList.remove('is-focus');
        cursor!.classList.add('is-on');
        aim(btn!, 0.55, 0.55);
        await wait(950);
        if (!running || destroyed) break;
        await press(btn!);
        if (!running || destroyed) break;
        btn!.classList.add('is-loading');
        await wait(800);
        if (!running || destroyed) break;
        btn!.classList.remove('is-loading');
        btn!.classList.add('is-done');
        lbl!.textContent = 'Subscribed';
        await wait(1100);
        if (!running || destroyed) break;
        cursor!.classList.remove('is-on');
        root!.classList.add('show-list');
        await wait(700);
        if (!running || destroyed) break;
        root!.classList.add('show-new');
        await wait(1100);
        if (!running || destroyed) break;
        cursor!.style.setProperty('--cx', '96cqw');
        cursor!.style.setProperty('--cy', '30cqw');
        cursor!.classList.add('is-on');
        await wait(60);
        if (!running || destroyed) break;
        aim(exp!, 0.5, 0.55);
        await wait(950);
        if (!running || destroyed) break;
        await press(exp!);
        if (!running || destroyed) break;
        exp!.classList.add('is-saving');
        await wait(1000);
        if (!running || destroyed) break;
        exp!.classList.remove('is-saving');
        exp!.classList.add('is-saved');
        expT!.textContent = 'contacts.csv';
        await wait(2000);
        if (!running || destroyed) break;
        cursor!.classList.remove('is-on');
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

    if (reduce) return;

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
        className="iveo-collect"
        role="img"
        aria-label="A visitor signs up with an email, and the contact appears in a list that can be exported as CSV"
      >
        <div className="ice-scene ice-form">
          <div ref={fieldRef} className="ice-field is-empty">
            <span className="ice-ph">you@example.com</span>
            <span ref={textRef} className="ice-text" />
            <span className="ice-caret" />
          </div>
          <div ref={btnRef} className="ice-btn">
            <svg
              className="ice-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth={3}
              strokeLinecap="round"
            >
              <path d="M12 3a9 9 0 1 0 9 9" />
            </svg>
            <svg
              className="ice-ok"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
            <span ref={lblRef} className="ice-lbl">
              Subscribe
            </span>
          </div>
        </div>

        <div className="ice-scene ice-list">
          <div className="ice-head">
            <span>Contacts</span>
            <span ref={expRef} className="ice-exp">
              <svg
                className="ice-dl"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
              </svg>
              <svg
                className="ice-ok2"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
              <span ref={expTRef}>Export CSV</span>
            </span>
          </div>
          <div className="ice-rows">
            <div className="ice-r is-new">
              <span>hello@maya.com</span>
              <em>just now</em>
            </div>
            <div className="ice-r">
              <span>+1 415 555 0142</span>
              <em>2m</em>
            </div>
            <div className="ice-r">
              <span>lena@paper.co</span>
              <em>1h</em>
            </div>
          </div>
        </div>

        <svg ref={cursorRef} className="ice-cursor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 3l14 8-6 1.8L10.6 19z"
            fill="#111"
            stroke="#fff"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </>
  );
};
