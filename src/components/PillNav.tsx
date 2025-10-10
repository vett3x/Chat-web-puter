"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { cn } from '@/lib/utils';
import { Wand2 } from 'lucide-react';
import { Button } from './ui/button';

export type PillNavItem = {
  label: string;
  href: string;
  ariaLabel?: string;
};

export interface PillNavProps {
  items: PillNavItem[];
  activeHref?: string;
  className?: string;
  ease?: string;
  baseColor?: string;
  pillColor?: string;
  hoveredPillTextColor?: string;
  pillTextColor?: string;
  onMobileMenuClick?: () => void;
  initialLoadAnimation?: boolean;
}

const PillNav: React.FC<PillNavProps> = ({
  items,
  activeHref,
  className = '',
  ease = 'power3.easeOut',
  baseColor = '#fff',
  pillColor = '#060010',
  hoveredPillTextColor = '#060010',
  pillTextColor,
  onMobileMenuClick,
  initialLoadAnimation = true
}) => {
  const resolvedPillTextColor = pillTextColor ?? baseColor;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const circleRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const tlRefs = useRef<Array<gsap.core.Timeline | null>>([]);
  const activeTweenRefs = useRef<Array<gsap.core.Tween | null>>([]);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const initialAnimationRan = useRef(false);

  const logoRef = useRef<HTMLAnchorElement | null>(null);
  const centralNavRef = useRef<HTMLUListElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);

  const navItems = items.slice(0, -1);
  const ctaItem = items[items.length - 1];

  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach(circle => {
        if (!circle?.parentElement) return;

        const pill = circle.parentElement as HTMLElement;
        const rect = pill.getBoundingClientRect();
        const { width: w, height: h } = rect;
        const R = ((w * w) / 4 + h * h) / (2 * h);
        const D = Math.ceil(2 * R) + 2;
        const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
        const originY = D - delta;

        circle.style.width = `${D}px`;
        circle.style.height = `${D}px`;
        circle.style.bottom = `-${delta}px`;

        gsap.set(circle, {
          xPercent: -50,
          scale: 0,
          transformOrigin: `50% ${originY}px`
        });

        const label = pill.querySelector<HTMLElement>('.pill-label');
        const white = pill.querySelector<HTMLElement>('.pill-label-hover');

        if (label) gsap.set(label, { y: 0 });
        if (white) gsap.set(white, { y: h + 12, opacity: 0 });

        const index = circleRefs.current.indexOf(circle);
        if (index === -1) return;

        tlRefs.current[index]?.kill();
        const tl = gsap.timeline({ paused: true });

        tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: 'auto' }, 0);

        if (label) {
          tl.to(label, { y: -(h + 8), duration: 2, ease, overwrite: 'auto' }, 0);
        }

        if (white) {
          gsap.set(white, { y: Math.ceil(h + 100), opacity: 0 });
          tl.to(white, { y: 0, opacity: 1, duration: 2, ease, overwrite: 'auto' }, 0);
        }

        tlRefs.current[index] = tl;
      });
    };

    layout();

    const onResize = () => layout();
    window.addEventListener('resize', onResize);

    if (document.fonts) {
      document.fonts.ready.then(layout).catch(() => {});
    }

    const menu = mobileMenuRef.current;
    if (menu) {
      gsap.set(menu, { visibility: 'hidden', opacity: 0, y: -10 });
    }

    if (initialLoadAnimation && !initialAnimationRan.current) {
      gsap.from([logoRef.current, centralNavRef.current, ctaRef.current], {
        y: -20,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease
      });
      initialAnimationRan.current = true;
    }

    return () => window.removeEventListener('resize', onResize);
  }, [items, ease, initialLoadAnimation]);

  const handleEnter = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), {
      duration: 0.3,
      ease,
      overwrite: 'auto'
    });
  };

  const handleLeave = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(0, {
      duration: 0.2,
      ease,
      overwrite: 'auto'
    });
  };

  const toggleMobileMenu = () => {
    const newState = !isMobileMenuOpen;
    setIsMobileMenuOpen(newState);

    const hamburger = hamburgerRef.current;
    const menu = mobileMenuRef.current;

    if (hamburger) {
      const lines = hamburger.querySelectorAll('.hamburger-line');
      if (newState) {
        gsap.to(lines[0], { rotation: 45, y: 3, duration: 0.3, ease });
        gsap.to(lines[1], { rotation: -45, y: -3, duration: 0.3, ease });
      } else {
        gsap.to(lines[0], { rotation: 0, y: 0, duration: 0.3, ease });
        gsap.to(lines[1], { rotation: 0, y: 0, duration: 0.3, ease });
      }
    }

    if (menu) {
      if (newState) {
        gsap.set(menu, { visibility: 'visible' });
        gsap.fromTo(
          menu,
          { opacity: 0, y: -10 },
          { opacity: 1, y: 0, duration: 0.3, ease }
        );
      } else {
        gsap.to(menu, {
          opacity: 0,
          y: -10,
          duration: 0.2,
          ease,
          onComplete: () => {
            gsap.set(menu, { visibility: 'hidden' });
          }
        });
      }
    }

    onMobileMenuClick?.();
  };

  const isExternalLink = (href: string) =>
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('//') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('#');

  const isRouterLink = (href?: string) => href && !isExternalLink(href);

  const cssVars = {
    ['--base']: baseColor,
    ['--pill-bg']: pillColor,
    ['--hover-text']: hoveredPillTextColor,
    ['--pill-text']: resolvedPillTextColor,
    ['--nav-h']: '42px',
    ['--logo']: '36px',
    ['--pill-pad-x']: '18px',
    ['--pill-gap']: '3px'
  } as React.CSSProperties;

  return (
    <header className={cn("fixed top-4 left-0 right-0 z-50", className)}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <nav
          className="flex items-center justify-between h-16 relative"
          aria-label="Primary"
          style={cssVars}
        >
          <Link href="/" ref={logoRef} className="flex items-center gap-2 text-white">
            <Wand2 className="h-6 w-6 text-primary-light-purple" />
            <span className="font-bold text-lg hidden sm:inline">DeepAI Coder</span>
          </Link>

          <div
            className="relative items-center rounded-full hidden md:flex"
            style={{ height: 'var(--nav-h)' }}
          >
            <ul
              ref={centralNavRef}
              role="menubar"
              className="list-none flex items-stretch m-0 p-[3px] h-full"
              style={{ gap: 'var(--pill-gap)' }}
            >
              {navItems.map((item, i) => {
                const isActive = activeHref === item.href;
                const pillStyle: React.CSSProperties = {
                  color: 'var(--pill-text, var(--base, #000))',
                  paddingLeft: 'var(--pill-pad-x)',
                  paddingRight: 'var(--pill-pad-x)'
                };
                const PillContent = (
                  <>
                    <span
                      className="hover-circle absolute left-1/2 bottom-0 rounded-full z-[1] block pointer-events-none"
                      style={{ background: 'hsla(0, 0%, 100%, 0.1)', backdropFilter: 'blur(4px)', willChange: 'transform' }}
                      aria-hidden="true"
                      ref={el => { circleRefs.current[i] = el; }}
                    />
                    <span className="label-stack relative inline-block leading-[1] z-[2]">
                      <span className="pill-label relative z-[2] inline-block leading-[1]" style={{ willChange: 'transform' }}>{item.label}</span>
                      <span className="pill-label-hover absolute left-0 top-0 z-[3] inline-block" style={{ color: 'var(--hover-text, #fff)', willChange: 'transform, opacity' }} aria-hidden="true">{item.label}</span>
                    </span>
                    {isActive && <span className="absolute left-1/2 -bottom-[6px] -translate-x-1/2 w-3 h-3 rounded-full z-[4]" style={{ background: 'var(--base, #000)' }} aria-hidden="true" />}
                  </>
                );
                const basePillClasses = 'relative overflow-hidden inline-flex items-center justify-center h-full no-underline rounded-full box-border font-semibold text-[16px] leading-[0] uppercase tracking-[0.2px] whitespace-nowrap cursor-pointer px-0 bg-primary-light-purple/20 backdrop-blur-md border border-primary-light-purple/30';
                return (
                  <li key={item.href} role="none" className="flex h-full">
                    {isRouterLink(item.href) ? (
                      <Link role="menuitem" href={item.href} className={basePillClasses} style={pillStyle} aria-label={item.ariaLabel || item.label} onMouseEnter={() => handleEnter(i)} onMouseLeave={() => handleLeave(i)}>{PillContent}</Link>
                    ) : (
                      <a role="menuitem" href={item.href} className={basePillClasses} style={pillStyle} aria-label={item.ariaLabel || item.label} onMouseEnter={() => handleEnter(i)} onMouseLeave={() => handleLeave(i)}>{PillContent}</a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div ref={ctaRef} className="hidden md:flex">
            <Button asChild className="bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full">
              <Link href={ctaItem.href}>{ctaItem.label}</Link>
            </Button>
          </div>

          <button
            ref={hamburgerRef}
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
            className="md:hidden absolute right-0 rounded-full border-0 flex flex-col items-center justify-center gap-1 cursor-pointer p-0 bg-black/30 backdrop-blur-md border border-white/10"
            style={{ width: 'var(--nav-h)', height: 'var(--nav-h)' }}
          >
            <span className="hamburger-line w-4 h-0.5 rounded origin-center transition-all duration-[10ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]" style={{ background: 'var(--base, #fff)' }} />
            <span className="hamburger-line w-4 h-0.5 rounded origin-center transition-all duration-[10ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]" style={{ background: 'var(--base, #fff)' }} />
          </button>
        </nav>
      </div>
      <div
        ref={mobileMenuRef}
        className="md:hidden absolute top-16 left-0 right-0 bg-black/80 backdrop-blur-xl transition-all duration-300 ease-in-out overflow-hidden"
        style={{ ...cssVars, maxHeight: isMobileMenuOpen ? '100vh' : '0', borderTop: isMobileMenuOpen ? '1px solid rgba(255, 255, 255, 0.1)' : 'none' }}
      >
        <ul className="list-none m-0 p-4 flex flex-col gap-2">
          {items.map(item => {
            const linkClasses = 'block py-3 px-4 text-[16px] font-medium rounded-full transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] text-center bg-primary-light-purple/20 backdrop-blur-md border border-primary-light-purple/30';
            return (
              <li key={item.href}>
                {isRouterLink(item.href) ? (
                  <Link href={item.href} className={linkClasses} style={{ color: 'var(--pill-text, #000)' }} onClick={() => setIsMobileMenuOpen(false)}>{item.label}</Link>
                ) : (
                  <a href={item.href} className={linkClasses} style={{ color: 'var(--pill-text, #000)' }} onClick={() => setIsMobileMenuOpen(false)}>{item.label}</a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </header>
  );
};

export default PillNav;