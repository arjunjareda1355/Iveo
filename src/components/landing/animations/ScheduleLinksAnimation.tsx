import React, { useEffect, useRef } from 'react';

const CSS = `
  .iveo-sched{
    --is-bg:#F5F5F5;
    --is-cell:#FAFAFA;
    --is-border:#E5E5E5;
    --is-text:#8F8F8F;
    --is-on-bg:#0A0A0A;
    --is-on-text:#FFFFFF;
    --is-mono:'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

    container-type:inline-size;
    box-sizing:border-box;
    width:100%;
    aspect-ratio:232/90;
    background:var(--is-bg);
    border:1px solid var(--is-border);
    border-radius:10px;
    overflow:hidden;
    position:relative;
    display:flex;align-items:center;justify-content:center;
  }
  .iveo-sched *{box-sizing:border-box}

  .iveo-sched .is-cal{
    width:72cqw;display:grid;grid-template-columns:repeat(7,1fr);
    column-gap:2cqw;row-gap:2.2cqw;font-family:var(--is-mono);
  }
  .iveo-sched .is-dow{
    height:4cqw;margin-bottom:.2cqw;display:flex;align-items:center;justify-content:center;
    font-size:2.8cqw;color:#8d8d8d;
  }
  .iveo-sched .is-day{
    height:7.4cqw;display:flex;align-items:center;justify-content:center;
    font-size:3.2cqw;color:var(--is-text);
    background:var(--is-cell);border:1px solid var(--is-border);border-radius:1.8cqw;
    transition:background .28s, color .28s, border-color .28s;
  }
  .iveo-sched .is-day.is-past{color:#6f6f6f}
  .iveo-sched .is-day.is-on{
    background:var(--is-on-bg);color:var(--is-on-text);border-color:var(--is-on-bg);
    animation:is-pop .35s cubic-bezier(.2,.9,.3,1.3);
  }

  .iveo-sched .is-cursor{
    position:absolute;left:0;top:0;width:5cqw;height:5cqw;z-index:5;pointer-events:none;
    transform:translate(var(--cx,95cqw),var(--cy,40cqw));
    transition:transform .8s cubic-bezier(.4,0,.2,1), opacity .3s;
    opacity:0;filter:drop-shadow(0 .3cqw .5cqw rgba(0,0,0,.25));
  }
  .iveo-sched .is-cursor.is-on{opacity:1}

  @keyframes is-pop{0%{transform:scale(.8)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
  @media (prefers-reduced-motion:reduce){
    .iveo-sched *{animation:none!important;transition:none!important}
  }
`;

const DAYS = Array.from({ length: 14 }, (_, idx) => idx + 10);
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const ScheduleLinksAnimation: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const cursorRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const cursor = cursorRef.current;
    const days = dayRefs.current.filter((d): d is HTMLSpanElement => d !== null);
    if (!root || !cursor || days.length === 0) return;

    const START = 3;
    const END = 7;
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

    function aim(i: number) {
      const rr = root!.getBoundingClientRect();
      const cr = days[i].getBoundingClientRect();
      const u = rr.width / 100;
      if (u <= 0) return;
      const x = (cr.left - rr.left + cr.width * 0.45) / u - 1;
      const y = (cr.top - rr.top + cr.height * 0.45) / u - 0.7;
      cursor!.style.setProperty('--cx', `${x}cqw`);
      cursor!.style.setProperty('--cy', `${y}cqw`);
    }

    function on(i: number) {
      days[i]?.classList.add('is-on');
    }

    function off(i: number) {
      days[i]?.classList.remove('is-on');
    }

    async function loop() {
      if (running || destroyed || document.hidden) return;
      running = true;
      while (running && !destroyed) {
        days.forEach((_, i) => off(i));
        cursor!.classList.remove('is-on');
        cursor!.style.setProperty('--cx', '95cqw');
        cursor!.style.setProperty('--cy', '40cqw');
        await wait(900);
        if (!running || destroyed) break;
        cursor!.classList.add('is-on');
        aim(START);
        await wait(900);
        if (!running || destroyed) break;
        on(START);
        await wait(450);
        if (!running || destroyed) break;
        aim(END);
        for (let i = START + 1; i <= END && running && !destroyed; i++) {
          await wait(170);
          if (!running || destroyed) break;
          on(i);
        }
        if (!running || destroyed) break;
        await wait(1900);
        if (!running || destroyed) break;
        cursor!.classList.remove('is-on');
        for (let j = START; j <= END && running && !destroyed; j++) {
          off(j);
          await wait(230);
        }
        if (!running || destroyed) break;
        await wait(1300);
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
      for (let k = START; k <= END; k++) on(k);
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
        className="iveo-sched"
        role="img"
        aria-label="Picking a start and end date for a link"
      >
        <div className="is-cal">
          {DOW.map((d, idx) => (
            <span key={`dow-${idx}`} className="is-dow">
              {d}
            </span>
          ))}
          {DAYS.map((day, idx) => (
            <span
              key={day}
              ref={(el) => {
                dayRefs.current[idx] = el;
              }}
              className={`is-day${idx < 3 ? ' is-past' : ''}`}
            >
              {day}
            </span>
          ))}
        </div>
        <svg ref={cursorRef} className="is-cursor" viewBox="0 0 24 24" aria-hidden="true">
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
