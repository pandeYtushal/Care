import { Link } from 'react-router-dom';

export default function EssentialCookieNotice({ className = '' }: { className?: string }) {
  return (
    <p className={`essential-cookie-note ${className}`.trim()}>
      We use essential cookies to keep sign-in secure and support Google sign-in or calendar connection.{' '}
      <Link to="/privacy">Read our privacy notice.</Link>
    </p>
  );
}
