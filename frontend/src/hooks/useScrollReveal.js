import { useEffect, useRef } from 'react';

const DEFAULT_OPTS = {
  threshold: 0.12,
  rootMargin: '0px 0px -60px 0px',
  once: true,
};

/**
 * Attach to any container ref. Finds all children with
 * .reveal-up / .reveal-fade / .reveal-left / .reveal-right
 * and adds .is-visible when they enter the viewport.
 *
 * Usage:
 *   const ref = useScrollReveal();
 *   <section ref={ref}>
 *     <h2 className="reveal-up">...</h2>
 *     <div className="reveal-up" style={{ transitionDelay: '120ms' }}>...</div>
 *   </section>
 */
export function useScrollReveal(opts = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const options = { ...DEFAULT_OPTS, ...opts };
    const targets = el.querySelectorAll(
      '.reveal-up, .reveal-fade, .reveal-left, .reveal-right'
    );

    if (!targets.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          if (options.once) observer.unobserve(entry.target);
        } else if (!options.once) {
          entry.target.classList.remove('is-visible');
        }
      });
    }, {
      threshold: options.threshold,
      rootMargin: options.rootMargin,
    });

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  return ref;
}

export default useScrollReveal;
