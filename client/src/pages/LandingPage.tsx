import { motion, useScroll } from 'framer-motion';
import {
  ArrowRight, Video, CalendarDays, FileText, ArrowUpRight,
  ShieldCheck, Clock3, Stethoscope, X, Heart, Activity, Check,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { MotionConfig, useMotionValueEvent } from 'framer-motion';
import Footer from '../components/Footer';
import { api, ApiError } from '../lib/api';
import '../landing.css';

const ease = [0.16, 1, 0.3, 1] as const;
type ConsultationService = { id: string; name: string; description: string | null; duration_minutes: number; fee_paise: number | null; currency: string | null; methods: string[] };

export default function LandingPage() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const publicMenuRef = useRef<HTMLDivElement>(null);
  const [services, setServices] = useState<ConsultationService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');

  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', v => setScrolled(v > 20));

  useEffect(() => {
    setMenuOpen(false);
    if (location.pathname === '/') { window.scrollTo({ top: 0 }); return; }
    const map: Record<string, string> = {
      '/services': 'services', '/consultations': 'consultations',
      '/faq': 'faq', '/contact': 'contact',
    };
    const id = map[location.pathname];
    if (id) window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 0);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    api<{ services: ConsultationService[] }>('/booking/services')
      .then(result => { if (active) setServices(result.services); })
      .catch(error => { if (active) setServicesError(error instanceof ApiError ? error.message : 'Consultation options are temporarily unavailable.'); })
      .finally(() => { if (active) setServicesLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const q = window.matchMedia('(min-width: 768px)');
    const fn = () => { if (q.matches) setMenuOpen(false); };
    q.addEventListener('change', fn); fn();
    return () => q.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    const prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(publicMenuRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? []);
    focusable()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
      if (e.key === 'Tab') {
        const els = focusable(); if (!els.length) return;
        if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els[els.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === els[els.length - 1]) { e.preventDefault(); els[0].focus(); }
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      if (prevFocus?.isConnected) prevFocus.focus(); else menuButtonRef.current?.focus();
    };
  }, [menuOpen]);

  const steps = [
    { icon: CalendarDays, step: '01', title: 'Choose a visit', desc: 'Sign in to see the consultation options and appointment times currently offered by the practice.' },
    { icon: FileText, step: '02', title: 'Send a request', desc: 'Tell the practice what your visit is about and attach relevant reports if you wish.' },
    { icon: Clock3, step: '03', title: 'Follow its status', desc: 'Your appointment request appears in your account while the practice reviews it.' },
    { icon: Video, step: '04', title: 'Open visit details', desc: 'When a request is accepted, find the visit information and any available meeting link in your appointment.' },
  ];

  const faqs = [
    { q: 'How do I book an appointment?', a: 'Create or sign in to your patient account, choose an available service and time, then send your request. Follow its status in Appointments.' },
    { q: 'When is my visit confirmed?', a: 'A submitted request appears in your portal while the practice reviews it. Check the appointment status there for the latest update.' },
    { q: 'Can I share reports before my visit?', a: 'Yes. Attach relevant files during booking and review your uploaded records in the patient portal.' },
    { q: 'How do I join an online consultation?', a: 'Open the appointment in your portal. The meeting link is shown there once your visit is accepted.' },
    { q: 'Where can I find my visit information afterward?', a: 'Appointments, care history, records, and prescriptions are all in your patient portal after your visit.' },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div className="lp-root">

        {/* ─── NAVBAR ─── */}
        <header className={`lp-header${scrolled ? ' lp-header--scrolled' : ''}`}>
          <div className="lp-container lp-header__inner">
            <Link to="/" className="lp-logo">
              <span className="lp-logo__mark" aria-hidden="true"><Activity size={18} /></span>
              <span className="lp-logo__name">Dr. Kiran</span>
            </Link>

            <nav className="lp-nav" aria-label="Main">
              {[['About', '/about'], ['Philosophy', '/philosophy'], ['How it works', '/consultations'], ['Services', '/services'], ['FAQ', '/faq']].map(([l, to]) => (
                <Link key={to} to={to} className="lp-nav__link" aria-current={location.pathname === to ? 'page' : undefined}>{l}</Link>
              ))}
            </nav>

            <div className="lp-header__cta">
              <Link to="/login" className="btn btn-ghost">Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-sm lp-header__get-started">
                Get started <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>

          <button ref={menuButtonRef} type="button" className="lp-burger md:hidden"
              onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="mobile-public-navigation">
              <span className={`lp-burger__line${menuOpen ? ' lp-burger__line--top-open' : ''}`} />
              <span className={`lp-burger__line${menuOpen ? ' lp-burger__line--mid-open' : ''}`} />
              <span className={`lp-burger__line${menuOpen ? ' lp-burger__line--bot-open' : ''}`} />
            </button>
          </div>
        </header>

        {/* ─── MOBILE MENU ─── */}
        <div ref={publicMenuRef} id="mobile-public-navigation"
          className={`lp-mobile-menu${menuOpen ? ' lp-mobile-menu--open' : ''} md:hidden`}
          role={menuOpen ? 'dialog' : undefined} aria-modal={menuOpen || undefined}
          aria-label={menuOpen ? 'Practice navigation' : undefined}
          aria-hidden={!menuOpen} inert={!menuOpen}>
          <div className="lp-mobile-menu__header">
            <Link to="/" className="lp-logo" onClick={() => setMenuOpen(false)}>
              <span className="lp-logo__mark" aria-hidden="true"><Activity size={18} /></span>
              <span className="lp-logo__name">Dr. Kiran</span>
            </Link>
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Close" onClick={() => setMenuOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <nav className="lp-mobile-menu__nav">
            {[['About', '/about'], ['Philosophy', '/philosophy'], ['How it works', '/consultations'], ['Services', '/services'], ['FAQ', '/faq']].map(([l, to]) => (
                <Link key={to} to={to} className="lp-mobile-menu__link" aria-current={location.pathname === to ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{l}</Link>
            ))}
          </nav>
          <div className="lp-mobile-menu__footer">
            <Link to="/login" onClick={() => setMenuOpen(false)} className="btn btn-secondary btn-lg w-full">Sign in</Link>
            <Link to="/register" onClick={() => setMenuOpen(false)} className="btn btn-primary btn-lg w-full">Get started</Link>
          </div>
        </div>

        <main>
          {/* ─── HERO ─── */}
            <section className="lp-hero">
            <div className="lp-hero__blobs" aria-hidden="true">
              <div className="lp-hero__blob lp-hero__blob--a" />
              <div className="lp-hero__blob lp-hero__blob--b" />
            </div>

            <div className="lp-container lp-hero__inner">
              <motion.div className="lp-hero__copy"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}>

                <motion.div className="lp-badge" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
                  <Heart size={12} aria-hidden="true" />
                  Private telemedicine · India
                </motion.div>

                <motion.h1 className="lp-hero__heading" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.1, ease }}>
                  Care that truly <span className="lp-hero__heading-accent">listens.</span>
                </motion.h1>

                <motion.p className="lp-hero__sub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2, ease }}>
                  Meet with Dr. Kiran online, request an available appointment, and keep your visit information together in your patient account.
                </motion.p>

                <motion.div className="lp-hero__actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.35, ease }}>
                  <Link to="/patient/book" className="btn btn-primary btn-lg">
                    See consultation times <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                  <Link to="/about" className="btn btn-secondary btn-lg">Explore practice</Link>
                </motion.div>

                <motion.div className="lp-trust-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }}>
                  {([
                    [CalendarDays, 'Request an appointment'],
                    [FileText, 'Share visit reports'],
                    [Video, 'Online visit details'],
                  ] as [React.ElementType, string][]).map(([Icon, text]) => (
                    <span key={text} className="lp-trust-item"><Icon size={14} aria-hidden="true" />{text}</span>
                  ))}
                </motion.div>
              </motion.div>

              {/* A quiet illustration of the verified request journey. */}
              <motion.div className="lp-hero__mockup" aria-hidden="true"
                initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.15, ease }}>
                <div className="lp-story-art">
                  <div className="lp-story-art__sun" />
                  <div className="lp-story-art__paper">
                    <span className="lp-story-art__label">A visit, step by step</span>
                    <div className="lp-story-art__line"><span>01</span><i><Check size={14}/></i><strong>Choose a time</strong></div>
                    <div className="lp-story-art__line"><span>02</span><i><Check size={14}/></i><strong>Share what matters</strong></div>
                    <div className="lp-story-art__line"><span>03</span><i className="lp-story-art__pending"><Clock3 size={14}/></i><strong>Practice review</strong></div>
                    <p>Appointment requests are reviewed by the practice.</p>
                  </div>
                  <div className="lp-story-art__caption"><Activity size={16}/><span>Atelier Care<br/><small>Patient portal</small></span></div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* ─── HOW IT WORKS ─── */}
          <section id="consultations" className="lp-section lp-section--white lp-section--border-top">
            <div className="lp-container">
              <motion.div className="lp-section__header" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.8, ease }}>
                <span className="eyebrow">How it works</span>
                <h2>A clear path to your appointment.</h2>
                <p>See what happens from the first booking request through the appointment details in your account.</p>
              </motion.div>

              <div className="lp-steps">
                {steps.map(({ icon: Icon, step, title, desc }, i) => (
                  <motion.div key={step} className="lp-step-card"
                    initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-30px' }} transition={{ duration: 0.7, delay: i * 0.1, ease }}>
                    <div className="lp-step-card__row">
                      <div className="lp-step-card__icon"><Icon size={20} aria-hidden="true" /></div>
                      <span className="lp-step-card__num">{step}</span>
                    </div>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── SERVICES ─── */}
          <section id="services" className="lp-section">
            <div className="lp-container">
              <div className="lp-section__header">
                <span className="eyebrow">Care, at your pace</span>
                <h2>A thoughtful visit, from wherever you are.</h2>
                <p>Choose an available consultation in the patient portal. Dr. Kiran confirms and shares the visit details there.</p>
              </div>
              <div className="lp-service-grid">
                {servicesLoading ? <p className="lp-state" role="status">Loading current consultation options…</p> : servicesError ? <div className="lp-state lp-state--error" role="alert"><p>{servicesError}</p><button className="lp-inline-action" type="button" onClick={() => { setServicesLoading(true); setServicesError(''); api<{ services: ConsultationService[] }>('/booking/services').then(result => setServices(result.services)).catch(() => setServicesError('Consultation options are temporarily unavailable. Please try again later.')).finally(() => setServicesLoading(false)); }}>Try again</button></div> : services.length === 0 ? <p className="lp-state">There are no consultation options available to book right now. Please check again later.</p> : services.map(service => (
                  <article key={service.id} className="lp-service-card">
                    <div className="lp-service-card__top"><span className="lp-service-card__icon"><Stethoscope size={21} aria-hidden="true" /></span><span className="lp-service-card__duration">{service.duration_minutes} min</span></div>
                    <h3>{service.name}</h3>
                    {service.description && <p>{service.description}</p>}
                    <div className="lp-service-card__meta">
                      {service.fee_paise !== null && service.fee_paise !== undefined && <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: service.currency || 'INR', maximumFractionDigits: 0 }).format(service.fee_paise / 100)}</span>}
                      <span>{service.methods.map(method => method === 'GOOGLE_MEET' ? 'Online' : method === 'IN_PERSON' ? 'In person' : method).join(' · ')}</span>
                    </div>
                    <Link to="/patient/book" className="lp-service-card__link">Choose a time <ArrowUpRight size={16} aria-hidden="true" /></Link>
                  </article>
                ))}
              </div>
              <p className="lp-service-note"><ShieldCheck size={15} aria-hidden="true" /> Appointment requests are subject to review by the practice.</p>
            </div>
          </section>

          {/* ─── PHILOSOPHY QUOTE ─── */}
          <section className="lp-quote-section">
            <div className="lp-quote-section__glow" aria-hidden="true" />
            <div className="lp-container lp-quote-section__inner">
              <motion.div className="lp-quote-section__rule" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }} />
              <motion.blockquote className="lp-quote-section__quote" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.1, ease }}>
                “A thoughtful conversation is a good place to begin.”
              </motion.blockquote>
              <motion.cite className="lp-quote-section__cite" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.4 }}>
                Atelier Care · Dr. Kiran
              </motion.cite>
            </div>
          </section>

          {/* ─── FAQ ─── */}
          <section id="faq" className="lp-section lp-section--white lp-section--border-top">
            <div className="lp-container lp-faq__layout">
              <div className="lp-faq__intro">
                <span className="eyebrow">FAQ</span>
                <h2>Before your first visit.</h2>
                <p>A quick guide to booking and using your private care portal.</p>
              </div>
              <div className="lp-faq__list">
                {faqs.map(({ q, a }) => (
                  <details key={q} className="lp-faq__item">
                    <summary>{q}<span aria-hidden="true">+</span></summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* ─── CTA ─── */}
          <section id="contact" className="lp-section lp-cta">
            <div className="lp-container lp-cta__inner">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, ease }}>
                <div className="lp-cta__icon" aria-hidden="true"><Heart size={26} /></div>
                <span className="eyebrow">Begin your care</span>
                <h2>Take the next step when you’re ready.</h2>
                <p className="lp-cta__sub">Sign in or create a patient account to see the consultation options and request an available time.</p>
                <div className="lp-cta__actions">
                  <Link to="/patient/book" className="btn btn-primary btn-lg">View appointment options <ArrowRight size={17} aria-hidden="true" /></Link>
                  <Link to="/login" className="btn btn-secondary btn-lg">Sign in</Link>
                </div>
                <p className="lp-cta__clinician">
                  Are you a clinician?{' '}
                  <Link to="/login?workspace=doctor" className="lp-cta__clinician-link">Access clinical workspace →</Link>
                </p>
              </motion.div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </MotionConfig>
  );
}
