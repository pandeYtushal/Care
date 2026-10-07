import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight } from 'lucide-react';

const practiceLinks = [
  ['About the practice', '/about'],
  ['Care philosophy', '/philosophy'],
  ['Consultations', '/consultations'],
  ['Frequently asked questions', '/faq'],
] as const;

export default function Footer() {
  return (
    <footer className="practice-footer">
      <div className="practice-footer__inner">
        <div className="practice-footer__main">
          <div className="practice-footer__identity">
            <Link to="/" className="practice-footer__brand">
              <span className="practice-footer__mark" aria-hidden="true"><Activity size={17} /></span>
              <span>Dr. Kiran</span>
            </Link>
            <p>A private practice where care starts with listening and continues with you.</p>
          </div>

          <nav className="practice-footer__nav" aria-label="Practice information">
            <h2>Explore</h2>
            {practiceLinks.map(([label, to]) => <Link to={to} key={to}>{label}<ArrowUpRight size={13} aria-hidden="true" /></Link>)}
          </nav>

          <nav className="practice-footer__nav" aria-label="Patient portal and policies">
            <h2>Your care</h2>
            <Link to="/login">Patient sign in<ArrowUpRight size={13} aria-hidden="true" /></Link>
            <Link to="/register">Create an account<ArrowUpRight size={13} aria-hidden="true" /></Link>
            <Link to="/login?workspace=doctor">Clinician access<ArrowUpRight size={13} aria-hidden="true" /></Link>
            <Link to="/privacy">Privacy notice<ArrowUpRight size={13} aria-hidden="true" /></Link>
            <Link to="/terms">Terms of use<ArrowUpRight size={13} aria-hidden="true" /></Link>
          </nav>
        </div>

        <div className="practice-footer__bottom">
          <span>© {new Date().getFullYear()} Dr. Kiran</span>
          <span>For urgent or emergency care, contact local emergency services.</span>
        </div>
      </div>
    </footer>
  );
}
