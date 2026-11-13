import React, { useEffect, useMemo, useRef } from 'react';

const CSS = `
  .iveo-stats{
    --ist-bg:#F5F5F5;
    --ist-bar:#D4D4D4;
    --ist-ink:#0A0A0A;
    --ist-label:#666666;
    --ist-mono:'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

    container-type:inline-size;
    box-sizing:border-box;
    width:100%;
    aspect-ratio:232/136;
    background:var(--ist-bg);
    border:1px solid #E5E5E5;
    border-radius:10px;
    overflow:hidden;
    position:relative;
  }
  .iveo-stats *{box-sizing:border-box}

  .iveo-stats .ist-row{
    position:absolute;left:6.5cqw;right:6.5cqw;top:7cqw;
    display:flex;justify-content:space-between;
    font-size:3.3cqw;color:var(--ist-label);font-variant-numeric:tabular-nums;
  }
  .iveo-stats .ist-row b{color:var(--ist-ink);font-weight:600;margin-left:.9cqw}

  .iveo-stats .ist-bars{
    position:absolute;left:6.5cqw;right:6.5cqw;bottom:11cqw;height:26cqw;
    display:flex;align-items:flex-end;gap:2.5cqw;
  }
  .iveo-stats .ist-bar{
    flex:1;height:0;background:var(--ist-bar);border-radius:.6cqw;
    transition:height .8s cubic-bezier(.2,.9,.3,1), background .2s;
    transition-delay:var(--d,0s), 0s;
  }
  .iveo-stats.is-grown .ist-bar{height:var(--h)}
  .iveo-stats .ist-bar.is-last{background:var(--ist-ink)}
  .iveo-stats.is-sweep .ist-bar.is-last{background:var(--ist-bar)}
  .iveo-stats .ist-bar.is-active,
  .iveo-stats.is-sweep .ist-bar.is-last.is-active{background:var(--ist-ink)}

  .iveo-stats .ist-tip{
    position:absolute;bottom:0;left:50%;transform:translateX(-50%);
    padding:1.1cqw 2.2cqw;border-radius:1.6cqw;background:var(--ist-ink);color:#fff;
    font-family:var(--ist-mono);font-size:2.5cqw;white-space:nowrap;
    opacity:0;transition:opacity .2s, left .22s ease, bottom .22s ease;
    pointer-events:none;z-index:2;
  }
  .iveo-stats.is-sweep .ist-tip{opacity:1}

  .iveo-stats .ist-note{
    position:absolute;right:6.5cqw;bottom:4cqw;
    font-family:var(--ist-mono);font-size:2.5cqw;color:#9a9a9a;
  }

  @media (prefers-reduced-motion:reduce){
    .iveo-stats *{animation:none!important;transition:none!important}
  }
`;

const DATA = [54, 61, 68, 75, 80, 88, 94, 101, 108, 118, 128, 138, 171];
const MAXH = 26;
const VIEWS = 1284;
const CLICKS = 392;
const CTR = 30.5;

export const AnalyticsAnimation: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const barsElRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const viewsRef = useRef<HTMLElement>(null);
  const clicksRef = useRef<HTMLElement>(null);
  const ctrRef = useRef<HTMLElement>(null);
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const barSpecs = useMemo(
    () =>
      DATA.map((v, i) => ({
        value: v,
        isLast: i === DATA.length - 1,
        heightCqw: `${((v / 171) * MAXH).toFixed(2)}cqw`,
        delayMs: `${i * 55}ms`,
      })),
    []
  );

  useEffect(() => {
    const root = rootRef.current;
    const barsEl = barsElRef.current;
    const tip = tipRef.current;
    const vEl = viewsRef.current;
    const cEl = clicksRef.current;
    const rEl = ctrRef.current;
    const bars = barRefs.current.filter((b): b is HTMLSpanElement => b !== null);
    if (!root || !barsEl || !tip || !vEl || !cEl || !rEl || bars.length === 0) return;

    let running = false;
    let destroyed = false;
    let inView = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let resolvePending: (() => void) | null = null;
    let raf: number | null = null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function fmt(n: number) {
      return Math.round(n).toLocaleString('en-US');
    }

    function setNums(p: number) {
      vEl!.textContent = fmt(VIEWS * p);
      cEl!.textContent = fmt(CLICKS * p);
      rEl!.textContent = `${(CTR * p).toFixed(1)}%`;
    }

    function countUp(ms: number) {
      const t0 = performance.now();
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      const step = (t: number) => {
        if (!running || destroyed) return;
        const p = Math.min(1, (t - t0) / ms);
        const e = 1 - Math.pow(1 - p, 3);
        setNums(e);
        if (p < 1) {
          raf = requestAnimationFrame(step);
        } else {
          raf = null;
        }
      };
      raf = requestAnimationFrame(step);
    }

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

    function showTip(i: number) {
      const bar = bars[i];
      const w = barsEl!.clientWidth;
      if (!bar || w <= 0) return;
      let cx = ((bar.offsetLeft + bar.offsetWidth / 2) / w) * 100;
      cx = Math.max(11, Math.min(89, cx));
      tip!.style.left = `${cx}%`;
      tip!.style.bottom = `calc(${((DATA[i] / 171) * MAXH).toFixed(2)}cqw + 1.4cqw)`;
      tip!.textContent = `${DATA[i]} views`;
    }

    function activate(i: number) {
      bars.forEach((b, k) => b.classList.toggle('is-active', k === i));
      showTip(i);
    }

    function reset() {
      root!.classList.remove('is-grown', 'is-sweep');
      bars.forEach((b) => b.classList.remove('is-active'));
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      setNums(0);
    }

    async function loop() {
      if (running || destroyed || document.hidden) return;
      running = true;
      while (running && !destroyed) {
        reset();
        await wait(700);
        if (!running || destroyed) break;
        root!.classList.add('is-grown');
        countUp(1500);
        await wait(2100);
        if (!running || destroyed) break;
        root!.classList.add('is-sweep');
        for (let i = 0; i < bars.length && running && !destroyed; i++) {
          activate(i);
          await wait(i === bars.length - 1 ? 0 : 210);
        }
        if (!running || destroyed) break;
        await wait(2600);
        if (!running || destroyed) break;
        root!.classList.remove('is-sweep');
        bars.forEach((b) => b.classList.remove('is-active'));
        await wait(1600);
      }
      running = false;
    }

    function stop() {
      running = false;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      if (resolvePending) {
        const fn = resolvePending;
        resolvePending = null;
        fn();
      }
    }

    if (reduce) {
      root.classList.add('is-grown');
      setNums(1);
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
        className="iveo-stats"
        role="img"
        aria-label="Analytics showing views, clicks and click-through rate with a bar chart"
      >
        <div className="ist-row">
          <span>
            Views<b ref={viewsRef}>0</b>
          </span>
          <span>
            Clicks<b ref={clicksRef}>0</b>
          </span>
          <span>
            CTR<b ref={ctrRef}>0%</b>
          </span>
        </div>
        <div ref={barsElRef} className="ist-bars">
          {barSpecs.map((spec, i) => (
            <span
              key={i}
              ref={(el) => {
                barRefs.current[i] = el;
              }}
              className={`ist-bar${spec.isLast ? ' is-last' : ''}`}
              style={
                {
                  '--h': spec.heightCqw,
                  '--d': spec.delayMs,
                } as React.CSSProperties
              }
            />
          ))}
          <span ref={tipRef} className="ist-tip" />
        </div>
        <div className="ist-note">Sample data</div>
      </div>
    </>
  );
};
