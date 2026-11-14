import { useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

// A tool's "run sheet": numbered steps down a rail, in the order you do them, ending in a dock
// that holds the price or summary and the main button.

const closed = { inert: '' } as Record<string, string>;

function Collapse({ open, id, children }: { open: boolean; id: string; children: ReactNode }) {
  return (
    <div className={`collapse${open ? ' open' : ''}`} id={id} {...(open ? {} : closed)}>
      <div className="collapse-inner">{children}</div>
    </div>
  );
}

export function Step({
  n,
  title,
  done = false,
  last = false,
  aside,
  summary,
  collapsible = false,
  defaultOpen = false,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  last?: boolean;
  aside?: ReactNode;
  summary?: ReactNode; // shown beside the title of a collapsible step: what it's currently set to
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={`op${done ? ' done' : ''}${last ? ' last' : ''}`}>
      <div className="op-rail" aria-hidden="true">
        <span className="op-node">{done ? <Icon name="check" size={13} /> : n}</span>
      </div>
      <div className="op-main">
        {collapsible ? (
          <>
            <button type="button" className="op-head op-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
              <h2 className="op-title">{title}</h2>
              <span className="op-summary">{summary}</span>
              <Icon name="chevron" size={14} className={`twist${open ? ' open' : ''}`} />
            </button>
            <Collapse open={open} id={id}>
              <div className="op-body">{children}</div>
            </Collapse>
          </>
        ) : (
          <>
            <div className="op-head">
              <h2 className="op-title">{title}</h2>
              {aside && <div className="op-aside">{aside}</div>}
            </div>
            <div className="op-body">{children}</div>
          </>
        )}
      </div>
    </div>
  );
}

// An accordion row for things you rarely change. Closed, it still says what it's set to.
export function Fold({
  title,
  summary,
  defaultOpen = false,
  className = '',
  children,
}: {
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={`fold${open ? ' open' : ''}${className ? ` ${className}` : ''}`}>
      <button type="button" className="fold-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Icon name="chevron" size={14} className={`twist${open ? ' open' : ''}`} />
        <span className="fold-title">{title}</span>
        {summary != null && summary !== '' && <span className="fold-summary">{summary}</span>}
      </button>
      <Collapse open={open} id={id}>
        <div className="fold-body">{children}</div>
      </Collapse>
    </div>
  );
}

// The frosted bar at the foot of a sheet: what it'll cost / what will happen, and the main button.
// It sticks to the bottom of the window while the sheet is taller than the screen.
export function Dock({ info, children }: { info?: ReactNode; children: ReactNode }) {
  return (
    <footer className="dock">
      <div className="dock-info">{info}</div>
      <div className="dock-actions">{children}</div>
    </footer>
  );
}
