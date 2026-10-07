import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import {
  ArrowRight, Video, CalendarDays, FileText, ArrowUpRight, ClipboardList,
  ShieldCheck, Clock3, Stethoscope, X, Heart, Activity,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { MotionConfig, useMotionValueEvent } from 'framer-motion';
import Footer from '../components/Footer';
import '../landing.css';

const ease = [0.16, 1, 0.3, 1] as const;

export default function LandingPage() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const publicMenuRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 380], [1, 0]);
  const heroY = useTransform(scrollY, [0, 380], [0, 50]);
  const smoothY = useSpring(heroY, { stiffness: 90, damping: 28 });

  useMotionValueEvent(scrollY, 'change', v => setScrolled(v > 20));

  useEffect(() => {
    setMenuOpen(false);
    if (location.pathname === '/') { window.scrollTo({ top: 0 }); return; }
    const map: Record<string, string> = {
      '/services': 'services', '/consultations': 'consultations',
      '/faq': 'faq', '/contact': 'contact',
    };
    const id = map[location.pathname];
    if (id) window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }, [location.pathname]);

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
    { icon: CalendarDays, step: '01', title: 'Choose a time', desc: 'Pick an available slot that fits your life — no waiting rooms, no guesswork.' },
    { icon: FileText, step: '02', title: 'Share your story', desc: 'Describe what brings you in and attach any reports you want your doctor to see.' },
    { icon: Video, step: '03', title: 'Meet Dr. Kiran', desc: 'A calm, unhurried conversation from wherever you are.' },
    { icon: ArrowUpRight, step: '04', title: 'Continue your care', desc: 'Your records, prescriptions, and follow-ups are always one tap away.' },
  ];

  const services = [
    { icon: Stethoscope, title: 'Online consultations', body: 'Meet Dr. Kiran by video — a genuine conversation, not a rushed 5-minute call.', accent: 'brand' },
    { icon: FileText, title: 'Your care records', body: 'Keep the documents you share and the information from your visits in one place.', accent: 'records' },
    { icon: Clock3, title: 'Follow-up care', body: 'Return to your appointment details, visit updates, and prescriptions in your portal.', accent: 'amber' },
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
                <Link key={to} to={to} className="lp-nav__link">{l}</Link>
              ))}
            </nav>

            <div className="lp-header__cta">
              <Link to="/login" className="btn btn-ghost">Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-sm lp-header__get-started">
                Get started <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>

            <button ref={menuButtonRef} type="button" className="lp-burger md:hidden"
              onClick={() => setMenuOpen(!menuOpen)} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="mobile-public-navigation">
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
              <Link key={to} to={to} className="lp-mobile-menu__link" onClick={() => setMenuOpen(false)}>{l}</Link>
            ))}
          </nav>
          <div className="lp-mobile-menu__footer">
            <Link to="/login" onClick={() => setMenuOpen(false)} className="btn btn-secondary btn-lg w-full">Sign in</Link>
            <Link to="/register" onClick={() => setMenuOpen(false)} className="btn btn-primary btn-lg w-full">Get started</Link>
          </div>
        </div>

        <main>
          {/* ─── HERO ─── */}
          <section className="lp-hero" ref={heroRef}>
            <div className="lp-hero__blobs" aria-hidden="true">
              <div className="lp-hero__blob lp-hero__blob--a" />
              <div className="lp-hero__blob lp-hero__blob--b" />
            </div>

            <div className="lp-container lp-hero__inner">
              <motion.div className="lp-hero__copy" style={{ opacity: heroOpacity, y: smoothY }}
                initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease }}>

                <motion.div className="lp-badge" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
                  <Heart size={12} aria-hidden="true" />
                  Private telemedicine · India
                </motion.div>

                <motion.h1 className="lp-hero__heading" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.1, ease }}>
                  Care that truly <span className="lp-hero__heading-accent">listens.</span>
                </motion.h1>

                <motion.p className="lp-hero__sub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2, ease }}>
                  A private practice built around you — not waiting rooms. Unhurried conversations, genuine care, and modern convenience with Dr. Kiran.
                </motion.p>

                <motion.div className="lp-hero__actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.35, ease }}>
                  <Link to="/register" className="btn btn-primary btn-lg">
                    Book a consultation <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                  <Link to="/about" className="btn btn-secondary btn-lg">Explore practice</Link>
                </motion.div>

                <motion.div className="lp-trust-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }}>
                  {([
                    [CalendarDays, 'Appointments in one place'],
                    [FileText, 'Your records, in your account'],
                    [Video, 'Online consultations'],
                  ] as [React.ElementType, string][]).map(([Icon, text]) => (
                    <span key={text} className="lp-trust-item"><Icon size={14} aria-hidden="true" />{text}</span>
                  ))}
                </motion.div>
              </motion.div>

              {/* PORTAL MOCKUP */}
              <motion.div className="lp-hero__mockup" aria-hidden="true"
                initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 1.4, delay: 0.3, ease }}>
                <div className="lp-mockup__glow" />
                <div className="lp-mockup__card">
                  <div className="lp-mockup__topbar">
                    <div className="lp-mockup__logo-mark"><Activity size={15} /></div>
                    <div>
                      <p className="lp-mockup__title">Dr. Kiran</p>
                      <p className="lp-mockup__sub">Patient Portal</p>
                    </div>
                    <span className="lp-mockup__secure-badge">A quieter way to stay in touch</span>
                  </div>
                  <div className="lp-mockup__body">
                    <p className="eyebrow" style={{ marginBottom: 4 }}>YOUR CARE PORTAL</p>
                    <p className="lp-mockup__greeting">Your care, clearly organized.</p>
                    <div className="lp-mockup__stats">
                      {([[CalendarDays, 'Appointments'], [FileText, 'Reports'], [ClipboardList, 'Prescriptions']] as [React.ElementType, string][]).map(([Icon, l]) => (
                        <div key={l} className="lp-mockup__stat">
                          <Icon size={17} aria-hidden="true" /><span>{l}</span>
                        </div>
                      ))}
                    </div>
                    <div className="lp-mockup__appt">
                      <p className="lp-mockup__appt-label">Your next step</p>
                      <p className="lp-mockup__appt-name">Appointment details</p>
                      <p className="lp-mockup__appt-time">Visit time and joining details appear here after confirmation.</p>
                      <div className="lp-mockup__appt-btns">
                        <span className="lp-mockup__btn-ghost">View appointment</span>
                        <span className="lp-mockup__btn-outline">Care history</span>
                      </div>
                    </div>
                    <div className="lp-mockup__chips">
                      {['Care records', 'Prescriptions', 'Payments'].map(c => (
                        <span key={c} className="lp-mockup__chip">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* ─── HOW IT WORKS ─── */}
          <section id="consultations" className="lp-section lp-section--white lp-section--border-top">
            <div className="lp-container">
              <motion.div className="lp-section__header" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.8, ease }}>
                <span className="eyebrow">How it works</span>
                <h2>From first message to follow-up care</h2>
                <p>Every step of your care, designed to feel clear, warm, and completely unhurried.</p>
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
                {services.map(({ icon: Icon, title, body, accent }) => (
                  <article key={title} className={`lp-service-card lp-service-card--${accent}`}>
                    <div className="lp-service-card__icon"><Icon size={22} aria-hidden="true" /></div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
              <p className="lp-service-note"><ShieldCheck size={15} aria-hidden="true" /> Appointment options and available times are shown before you submit.</p>
            </div>
          </section>

          {/* ─── PHILOSOPHY QUOTE ─── */}
          <section className="lp-quote-section">
            <div className="lp-quote-section__glow" aria-hidden="true" />
            <div className="lp-container lp-quote-section__inner">
              <motion.div className="lp-quote-section__rule" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }} />
              <motion.blockquote className="lp-quote-section__quote" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.1, ease }}>
                "Care works best when there is time to listen."
              </motion.blockquote>
              <motion.cite className="lp-quote-section__cite" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.4 }}>
                Thoughtful care, with Dr. Kiran
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
                <h2>Ready when you are.</h2>
                <p className="lp-cta__sub">Create a patient account to book your first consultation, access your care records, and continue your journey — all in one private place.</p>
                <div className="lp-cta__actions">
                  <Link to="/register" className="btn btn-primary btn-lg">Create patient account <ArrowRight size={17} aria-hidden="true" /></Link>
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
