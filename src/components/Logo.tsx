// ConnecTag logo: mark (three connected dots, top one an orange ring) + wordmark, optional slogan.
import markLight from '../assets/brand/logo-mark.svg';
import markDark from '../assets/brand/logo-mark-dark.svg';

export const APP_NAME = 'ConnecTag';
export const SLOGAN = 'brings your tag a level up';

interface Props {
  variant?: 'light' | 'dark'; // light = for bright backgrounds, dark = for the dark app header
  showSlogan?: boolean;
  /** height of the mark in px; the wordmark scales with it */
  size?: number;
  className?: string;
}

export function Logo({ variant = 'light', showSlogan = false, size = 32, className }: Props) {
  const dark = variant === 'dark';
  return (
    <span className={`logo ${className ?? ''}`} style={{ ['--logo-h' as string]: `${size}px` }}>
      <img src={dark ? markDark : markLight} alt="" className="logo-mark" />
      <span className="logo-text">
        <span className="logo-word" style={{ color: dark ? '#fff' : 'var(--primary)' }}>
          {APP_NAME}
        </span>
        {showSlogan && (
          <span className="logo-slogan" style={{ color: dark ? '#a9b4bf' : 'var(--muted)' }}>
            {SLOGAN}
          </span>
        )}
      </span>
    </span>
  );
}
