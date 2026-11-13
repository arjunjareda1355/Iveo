import React, { useEffect, useRef } from 'react';

const CSS = `
  .iveo-arrange{
    --ia-bg:#F5F5F5;
    --ia-surface:#FAFAFA;
    --ia-border:#E5E5E5;
    --ia-text:#0A0A0A;
    --ia-muted:#8F8F8F;
    --ia-dots:#B5B5B5;
    --ia-on:#0A0A0A;
    --ia-off:#E3E3E3;

    container-type:inline-size;
    box-sizing:border-box;
    width:100%;
    aspect-ratio:232/187;
    background:var(--ia-bg);
    border:1px solid var(--ia-border);
    border-radius:10px;
    overflow:hidden;
    position:relative;
  }
  .iveo-arrange *{box-sizing:border-box}

  .iveo-arrange .ia-row{
    position:absolute;left:3.5cqw;width:93cqw;top:0;height:14.6cqw;
    display:flex;align-items:center;gap:3.4cqw;
    padding:0 4.5cqw 0 5cqw;
    background:var(--ia-surface);
    border:1px solid var(--ia-border);
    border-radius:2.6cqw;
    font-size:3.7cqw;font-weight:500;color:var(--ia-text);
    transform:translateY(var(--y,0cqw)) scale(var(--s,1));
    transition:transform .55s cubic-bezier(.2,.8,.2,1), box-shadow .3s, opacity .4s;
    z-index:1;will-change:transform;
  }
  .iveo-arrange .ia-row.is-drag{
    --s:1.03;z-index:3;background:#fff;
    box-shadow:0 2.4cqw 6cqw rgba(0,0,0,.14), 0 .4cqw 1.2cqw rgba(0,0,0,.08);
  }

  .iveo-arrange .ia-grip{display:grid;grid-template-columns:repeat(2,.8cqw);gap:.65cqw;flex:none}
  .iveo-arrange .ia-grip i{width:.8cqw;height:.8cqw;border-radius:50%;background:var(--ia-dots)}

  .iveo-arrange .ia-title{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .3s}
  .iveo-arrange .ia-row.is-off .ia-title{color:var(--ia-muted)}
  .iveo-arrange .ia-row.is-off{background:#f7f7f7}

  .iveo-arrange .ia-toggle{
    width:10.5cqw;height:6cqw;border-radius:3cqw;flex:none;position:relative;
    background:var(--ia-on);transition:background .3s, transform .15s;
  }
  .iveo-arrange .ia-toggle::after{
    content:"";position:absolute;top:.8cqw;left:5.3cqw;width:4.4cqw;height:4.4cqw;border-radius:50%;
    background:#fff;box-shadow:0 .2cqw .5cqw rgba(0,0,0,.2);
    transition:left .3s cubic-bezier(.3,.8,.3,1);
  }
  .iveo-arrange .ia-row.is-off .ia-toggle{background:var(--ia-off)}
  .iveo-arrange .ia-row.is-off .ia-toggle::after{left:.8cqw}
  .iveo-arrange .ia-toggle.is-press{transform:scale(.88)}

  .iveo-arrange .ia-cursor{
    position:absolute;left:0;top:0;width:5.5cqw;height:5.5cqw;z-index:5;pointer-events:none;
    transform:translate(var(--cx,80cqw),var(--cy,70cqw));
    transition:transform .7s cubic-bezier(.4,0,.2,1), opacity .3s;
    opacity:0;filter:drop-shadow(0 .3cqw .5cqw rgba(0,0,0,.25));
  }
  .iveo-arrange .ia-cursor.is-on{opacity:1}
  .iveo-arrange.is-fade .ia-row{opacity:0}

  @media (prefers-reduced-motion:reduce){
    .iveo-arrange *{animation:none!important;transition:none!important}
  }
`;

type RowKey = 'zine' | 'shop' | 'commission' | 'portfolio';

export const LinksArrangedAnimation: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const zineRef = useRef<HTMLDivElement>(null);
  const shopRef = useRef<HTMLDivElement>(null);
  const commissionRef = useRef<HTMLDivElement>(null);
  const portfolioRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const zine = zineRef.current;
    const shop = shopRef.current;
    const commission = commissionRef.current;
    const portfolio = portfolioRef.current;
    const cursor = cursorRef.current;
    if (!root || !zine || !shop || !commission || !portfolio || !cursor) return;

    const rows: Record<RowKey, HTMLDivElement> = {
      zine,
      shop,
      commission,
      portfolio,
    };
    const TOP = 6.2;
    const PITCH = 17.7;
    const initial: RowKey[] = ['zine', 'shop', 'commission', 'portfolio'];
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

    function slot(el: HTMLDivElement, n: number) {
      el.style.setProperty('--y', `${TOP + n * PITCH}cqw`);
    }

    function layout(order: RowKey[]) {
      order.forEach((id, n) => slot(rows[id], n));
    }

    function aimToggle(n: number) {
      cursor!.style.setProperty('--cx', '86cqw');
      cursor!.style.setProperty('--cy', `${TOP + n * PITCH + 6}cqw`);
    }

    function aimGrip(n: number) {
      cursor!.style.setProperty('--cx', '8.5cqw');
      cursor!.style.setProperty('--cy', `${TOP + n * PITCH + 6}cqw`);
    }

    async function flip(id: RowKey) {
      const t = rows[id].querySelector('.ia-toggle');
      if (!t) return;
      t.classList.add('is-press');
      await wait(140);
      if (!running || destroyed) return;
      t.classList.remove('is-press');
      rows[id].classList.toggle('is-off');
    }

    function reset() {
      root!.classList.remove('is-fade');
      cursor!.classList.remove('is-on');
      cursor!.style.setProperty('--cx', '80cqw');
      cursor!.style.setProperty('--cy', '70cqw');
      const allRowEls = [zine!, shop!, commission!, portfolio!];
      allRowEls.forEach((r) => {
        r.style.transition = 'none';
        r.classList.remove('is-drag');
      });
      rows.zine.classList.remove('is-off');
      rows.shop.classList.remove('is-off');
      rows.commission.classList.add('is-off');
      rows.portfolio.classList.remove('is-off');
      layout(initial);
      void root!.offsetWidth;
      allRowEls.forEach((r) => {
        r.style.transition = '';
      });
    }

    async function loop() {
      if (running || destroyed || document.hidden) return;
      running = true;
      while (running && !destroyed) {
        reset();
        await wait(900);
        if (!running || destroyed) break;
        cursor!.classList.add('is-on');
        aimToggle(1);
        await wait(850);
        if (!running || destroyed) break;
        await flip('shop');
        if (!running || destroyed) break;
        await wait(700);
        if (!running || destroyed) break;
        aimToggle(2);
        await wait(800);
        if (!running || destroyed) break;
        await flip('commission');
        if (!running || destroyed) break;
        await wait(800);
        if (!running || destroyed) break;
        aimGrip(3);
        await wait(800);
        if (!running || destroyed) break;
        rows.portfolio.classList.add('is-drag');
        await wait(250);
        if (!running || destroyed) break;
        aimGrip(0);
        layout(['portfolio', 'zine', 'shop', 'commission']);
        await wait(850);
        if (!running || destroyed) break;
        rows.portfolio.classList.remove('is-drag');
        await wait(300);
        if (!running || destroyed) break;
        cursor!.classList.remove('is-on');
        await wait(2200);
        if (!running || destroyed) break;
        root!.classList.add('is-fade');
        await wait(600);
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

    layout(initial);
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
        className="iveo-arrange"
        role="img"
        aria-label="Reordering links and switching them on or off"
      >
        <div ref={zineRef} className="ia-row" data-id="zine">
          <span className="ia-grip" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="ia-title">New zine, out now</span>
          <span className="ia-toggle" />
        </div>
        <div ref={shopRef} className="ia-row" data-id="shop">
          <span className="ia-grip" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="ia-title">Shop prints</span>
          <span className="ia-toggle" />
        </div>
        <div ref={commissionRef} className="ia-row is-off" data-id="commission">
          <span className="ia-grip" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="ia-title">Commission waitlist</span>
          <span className="ia-toggle" />
        </div>
        <div ref={portfolioRef} className="ia-row" data-id="portfolio">
          <span className="ia-grip" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="ia-title">Portfolio</span>
          <span className="ia-toggle" />
        </div>

        <svg ref={cursorRef} className="ia-cursor" viewBox="0 0 24 24" aria-hidden="true">
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
