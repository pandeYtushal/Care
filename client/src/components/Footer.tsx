import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import BrandMark from './BrandMark';
import EssentialCookieNotice from './EssentialCookieNotice';

const practiceLinks = [
  ['About the practice', '/about'],
  ['Care philosophy', '/philosophy'],
  ['Consultations', '/consultations'],
  ['Frequently asked questions', '/faq'],
] as const;

export default function Footer() {
  return (
    <footer className="public-site-footer border-t border-border pt-[clamp(3rem,7vw,5.25rem)] pb-[calc(1.375rem+env(safe-area-inset-bottom,0px))] text-ink">
      <div className="mx-auto w-[calc(100%-2.25rem)] max-w-[80rem] sm:w-[calc(100%-4rem)]">
        <div className="grid grid-cols-2 gap-x-5 gap-y-7 pb-9 min-[700px]:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(160px,0.65fr))] min-[700px]:gap-11 min-[700px]:pb-12">
          <div className="col-span-2 min-w-0 min-[700px]:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2.5 text-base font-semibold text-ink no-underline">
              <span className="grid size-[35px] place-items-center rounded-full bg-brand-subtle"><BrandMark /></span>
              <span>Dr. Kiran</span>
            </Link>
            <p className="mt-[15px] max-w-[36ch] text-[13px] leading-[1.75] text-ink-muted">A private practice where care starts with listening and continues with you.</p>
          </div>

          <nav className="grid min-w-0 content-start gap-2 min-[700px]:gap-3" aria-label="Practice information">
            <h2 className="mb-1 mt-0 font-sans text-[10px] font-bold uppercase tracking-[0.13em] text-ink-muted">Explore</h2>
            {practiceLinks.map(([label, to]) => <Link className="group flex min-h-9 w-full items-center gap-1.5 text-xs leading-[1.45] text-ink no-underline hover:text-brand-active hover:underline hover:underline-offset-4 min-[700px]:min-h-8 min-[700px]:w-fit" to={to} key={to}>{label}<ArrowUpRight className="hidden shrink-0 opacity-50 transition duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 min-[700px]:block" size={13} aria-hidden="true" /></Link>)}
          </nav>

          <nav className="grid min-w-0 content-start gap-2 min-[700px]:gap-3" aria-label="Patient portal and policies">
            <h2 className="mb-1 mt-0 font-sans text-[10px] font-bold uppercase tracking-[0.13em] text-ink-muted">Your care</h2>
            <Link className="group flex min-h-9 w-full items-center gap-1.5 text-xs leading-[1.45] text-ink no-underline hover:text-brand-active hover:underline hover:underline-offset-4 min-[700px]:min-h-8 min-[700px]:w-fit" to="/login">Patient sign in<ArrowUpRight className="hidden shrink-0 opacity-50 transition duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 min-[700px]:block" size={13} aria-hidden="true" /></Link>
            <Link className="group flex min-h-9 w-full items-center gap-1.5 text-xs leading-[1.45] text-ink no-underline hover:text-brand-active hover:underline hover:underline-offset-4 min-[700px]:min-h-8 min-[700px]:w-fit" to="/register">Create an account<ArrowUpRight className="hidden shrink-0 opacity-50 transition duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 min-[700px]:block" size={13} aria-hidden="true" /></Link>
            <Link className="group flex min-h-9 w-full items-center gap-1.5 text-xs leading-[1.45] text-ink no-underline hover:text-brand-active hover:underline hover:underline-offset-4 min-[700px]:min-h-8 min-[700px]:w-fit" to="/login?workspace=doctor">Clinician access<ArrowUpRight className="hidden shrink-0 opacity-50 transition duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 min-[700px]:block" size={13} aria-hidden="true" /></Link>
            <Link className="group flex min-h-9 w-full items-center gap-1.5 text-xs leading-[1.45] text-ink no-underline hover:text-brand-active hover:underline hover:underline-offset-4 min-[700px]:min-h-8 min-[700px]:w-fit" to="/privacy">Privacy notice<ArrowUpRight className="hidden shrink-0 opacity-50 transition duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 min-[700px]:block" size={13} aria-hidden="true" /></Link>
            <Link className="group flex min-h-9 w-full items-center gap-1.5 text-xs leading-[1.45] text-ink no-underline hover:text-brand-active hover:underline hover:underline-offset-4 min-[700px]:min-h-8 min-[700px]:w-fit" to="/terms">Terms of use<ArrowUpRight className="hidden shrink-0 opacity-50 transition duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 min-[700px]:block" size={13} aria-hidden="true" /></Link>
            <Link className="group flex min-h-9 w-full items-center gap-1.5 text-xs leading-[1.45] text-ink no-underline hover:text-brand-active hover:underline hover:underline-offset-4 min-[700px]:min-h-8 min-[700px]:w-fit" to="/booking-policy">Booking & refund policies<ArrowUpRight className="hidden shrink-0 opacity-50 transition duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 min-[700px]:block" size={13} aria-hidden="true" /></Link>
          </nav>
        </div>

        <div className="border-t border-border pt-[18px]">
          <EssentialCookieNotice className="mb-4" />
          <div className="flex flex-col items-start gap-2 text-[11px] leading-[1.6] text-ink-muted min-[700px]:flex-row min-[700px]:justify-between min-[700px]:gap-[18px]">
            <span>© {new Date().getFullYear()} Dr. Kiran</span>
            <span>For urgent or emergency care, contact local emergency services.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
