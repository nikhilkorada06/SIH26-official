import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { ASSETS } from '../../assets/assets';
import { useAccessibility } from '../../context/AccessibilityContext';

const SLIDES = [
  { src: ASSETS.heroHeritage, alt: 'Maharashtra heritage — a hill fort in the Sahyadri mountains' },
  { src: ASSETS.multiDeptBanner, alt: 'Many Departments, One Platform, A Brighter Maharashtra — citizens accessing connected government services' }
];

export const HeroBannerCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const { pauseAnimations } = useAccessibility();
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const motionPaused = paused || pauseAnimations || reducedMotion;
  useEffect(() => {
    if (motionPaused || interacting) return;
    const timer = window.setInterval(() => setCurrentIndex(index => (index + 1) % SLIDES.length), 6000);
    return () => window.clearInterval(timer);
  }, [currentIndex, motionPaused, interacting]);

  return (
    <section aria-label="MahaSetu highlights" aria-roledescription="carousel" className="hero-carousel relative w-full overflow-hidden"
      onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }}>
      <div className="flex w-full transition-transform duration-700 ease-in-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
        {SLIDES.map((slide, index) => (
          <div key={slide.src} className="w-full shrink-0" role="group" aria-roledescription="slide"
            aria-label={`${index + 1} of ${SLIDES.length}`} aria-hidden={index !== currentIndex}>
            <img src={slide.src} alt={slide.alt} className="block w-full aspect-[3/1] object-cover" fetchPriority={index === 0 ? 'high' : 'auto'} />
          </div>
        ))}
      </div>
      <button onClick={() => setCurrentIndex(index => (index - 1 + SLIDES.length) % SLIDES.length)} aria-label="Previous banner" className="hero-arrow left-2 sm:left-6"><ChevronLeft /></button>
      <button onClick={() => setCurrentIndex(index => (index + 1) % SLIDES.length)} aria-label="Next banner" className="hero-arrow right-2 sm:right-6"><ChevronRight /></button>
      <div className="absolute bottom-1 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center rounded-full bg-slate-900/65 px-2">
        {SLIDES.map((slide, index) => (
          <button key={slide.src} onClick={() => setCurrentIndex(index)} aria-label={`Go to banner ${index + 1}`} aria-current={currentIndex === index ? 'true' : undefined} className="flex h-8 w-8 items-center justify-center">
            <span className={`h-2 rounded-full ${currentIndex === index ? 'w-5 bg-white' : 'w-2 bg-white/60'}`} />
          </button>
        ))}
        <button onClick={() => setPaused(value => !value)} disabled={pauseAnimations || reducedMotion} aria-label={motionPaused ? 'Play banner carousel' : 'Pause banner carousel'} className="flex h-8 w-8 items-center justify-center text-white disabled:opacity-50">
          {motionPaused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </div>
    </section>
  );
};
