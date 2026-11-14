import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';

export interface MenuAction {
  label: string;
  icon?: IconName;
  onSelect: () => void;
}

// A "…" button that opens a small frosted menu — for the actions you need now and then, so they
// don't crowd the ones you need every time.
export function MoreMenu({ label = 'More', actions }: { label?: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (actions.length === 0) return null;
  return (
    <span className="more" ref={ref}>
      <button type="button" className="btn small icon" aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen((o) => !o)}>
        <Icon name="more" size={16} />
      </button>
      {open && (
        <span className="menu" role="menu">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setOpen(false);
                a.onSelect();
              }}
            >
              {a.icon && <Icon name={a.icon} size={15} />}
              {a.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
