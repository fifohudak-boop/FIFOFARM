import { Icon, type IconName } from './Icon';

// The one bright button of each tool. While it can be pressed, hovering swaps the plain label for
// the win ("Make the video" → "Bring Mika to life") and loops its icon. Disabled or busy it stays
// still and keeps saying what's missing. Screen readers always get the plain label.
export function CtaButton({
  icon,
  label,
  win,
  busy = false,
  disabled = false,
  type = 'button',
  onClick,
  className = '',
}: {
  icon: IconName;
  label: string;
  win?: string;
  busy?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  className?: string;
}) {
  const live = !!win && !disabled && !busy;
  return (
    <button
      type={type}
      className={`cta${live ? ' cta-live' : ''}${busy ? ' cta-busy' : ''}${className ? ` ${className}` : ''}`}
      disabled={disabled || busy}
      onClick={onClick}
    >
      <span className="cta-icon">{busy ? <span className="spinner" aria-hidden="true" /> : <Icon name={icon} size={18} />}</span>
      <span className="cta-text">
        <span className="cta-label">{label}</span>
        {live && (
          <span className="cta-win" aria-hidden="true">
            {win}
          </span>
        )}
      </span>
    </button>
  );
}
