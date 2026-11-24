import { useEffect, useState } from 'react';
import type { FolderKind, Library, LibraryItem, Model } from '../types';
import { api } from '../api';
import { Icon } from './Icon';
import { LibraryGrid } from './LibraryGrid';
import { FOLDER_LABELS } from '../folders';

// "Choose from the library": the model's Reel Finder finds, AI Studio videos, references…
export function LibraryPicker({
  model,
  kinds,
  title,
  imagesOnly = false,
  videosOnly = false,
  onPick,
  onPickMany,
  onClose,
  onGoLibrary,
}: {
  model: Model;
  kinds: FolderKind[];
  title: string;
  imagesOnly?: boolean;
  videosOnly?: boolean;
  onPick: (item: LibraryItem) => void;
  // When given, you can tick several files (in order) and add them all at once.
  onPickMany?: (items: LibraryItem[]) => void;
  onClose: () => void;
  onGoLibrary?: () => void;
}) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [chosen, setChosen] = useState<LibraryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<FolderKind>(kinds[0]);

  useEffect(() => {
    api
      .library(model.id)
      .then(setLibrary)
      .catch((err) => setError(err.message));
  }, [model.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const folder = library?.[kind];
  const items = (folder?.items ?? []).filter((i) => (!imagesOnly || i.kind === 'image') && (!videosOnly || i.kind === 'video'));

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card stack" role="dialog" aria-modal="true" aria-label={title}>
        <div className="card-head" style={{ marginBottom: 0 }}>
          <h2>{title}</h2>
          <button type="button" className="btn small icon" onClick={onClose} aria-label="Close" title="Close">
            <Icon name="x" size={15} />
          </button>
        </div>
        {kinds.length > 1 && (
          <div className="lib-tabs">
            <div className="segmented" role="tablist" aria-label="Folders">
              {kinds.map((k) => (
                <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
                  {FOLDER_LABELS[k]}
                  {library && library[k].items.length > 0 && <span className="count">{library[k].items.length}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && <div className="notice error">{error}</div>}
        {!library && !error && <p className="muted">Loading…</p>}
        {folder && !folder.connected && (
          <div className="empty">No folder connected yet</div>
        )}
        {folder && folder.connected && items.length === 0 && (
          <div className="empty">Nothing here yet</div>
        )}
        <div className="modal-scroll">
          <LibraryGrid
            model={model}
            items={items}
            selected={onPickMany ? chosen.map((c) => c.path) : undefined}
            onPick={
              onPickMany
                ? (item) =>
                    setChosen((prev) => (prev.some((c) => c.path === item.path) ? prev.filter((c) => c.path !== item.path) : [...prev, item]))
                : onPick
            }
          />
        </div>
        {onPickMany && chosen.length > 0 && (
          <div className="picker-bar">
            <span className="picker-count">{chosen.length === 1 ? '1 selected' : `${chosen.length} selected, in this order`}</span>
            <button type="button" className="btn small" onClick={() => setChosen([])}>
              Clear
            </button>
            <button type="button" className="btn primary small picker-add" onClick={() => onPickMany(chosen)}>
              Add {chosen.length === 1 ? 'it' : `all ${chosen.length}`}
            </button>
          </div>
        )}
        {onGoLibrary && (
          <div className="row">
            <button
              className="btn link small"
              onClick={() => {
                onClose();
                onGoLibrary();
              }}
            >
              Open the library
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
