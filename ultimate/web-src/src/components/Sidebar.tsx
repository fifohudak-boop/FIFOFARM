import { useEffect, type ReactNode } from 'react';
import type { Tab } from '../App';
import { PIPELINE, REVIEW, SETUP, navItemOf, type NavItem } from '../systems';
import { Icon } from './Icon';

// The frosted sidebar. The six tools sit on one rail, top to bottom, in the order the work
// happens; below them, what the work produced (library, history, numbers) and the setup pages.
// On a phone it slides in as a drawer.
export function Sidebar({
  brand,
  current,
  canManage,
  engineOk,
  huntingName,
  open,
  onClose,
  onNavigate,
  switcher,
  account,
}: {
  brand: string;
  current: Tab;
  canManage: boolean;
  engineOk: boolean;
  huntingName: string | null;
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: Tab) => void;
  switcher: ReactNode;
  account?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const active = navItemOf(current)?.id;

  const item = (it: NavItem) => (
    <button
      key={it.id}
      type="button"
      className={`side-item${active === it.id ? ' active' : ''}`}
      aria-current={active === it.id ? 'page' : undefined}
      onClick={() => {
        onNavigate(it.id);
        onClose();
      }}
    >
      <span className="side-node">
        <Icon name={it.icon} size={15} />
      </span>
      <span className="side-text">{it.label}</span>
      {it.id === 'reels' && huntingName && <span className="tab-dot inline" title={`Hunting for ${huntingName}`} />}
    </button>
  );

  return (
    <>
      {open && <div className="side-scrim" onClick={onClose} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="side-brand">
          <img className="brand-logo" src="/icon.svg" alt="" />
          <span className="brand-name">{brand}</span>
        </div>
        {switcher}
        <nav className="side-nav" aria-label="Main">
          <div className="side-group pipeline">
            <div className="side-label">Pipeline</div>
            {PIPELINE.map(item)}
          </div>
          <div className="side-group">
            <div className="side-label">Review</div>
            {REVIEW.map(item)}
          </div>
        </nav>
        <div className="side-foot">
          {SETUP.filter((it) => canManage || it.id !== 'settings').map(item)}
          <div className="side-status">
            <span className={`brand-dot${engineOk ? '' : ' down'}`} />
            <span>{engineOk ? 'Posting engine connected' : 'Posting engine not connected'}</span>
          </div>
          {account}
        </div>
      </aside>
    </>
  );
}
