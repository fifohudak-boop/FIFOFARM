import { useCallback, useEffect, useState } from 'react';
import type { FolderKind, Library, Model } from '../types';
import type { Handoff } from '../App';
import { api } from '../api';
import { LibraryGrid } from '../components/LibraryGrid';
import { FOLDER_LABELS } from '../folders';
import { Icon } from '../components/Icon';
import { MoreMenu, type MenuAction } from '../components/MoreMenu';

const KINDS: FolderKind[] = ['found', 'generated', 'edited', 'references', 'photos'];

// Everything of one model in one place: what Reel Finder found, what AI Studio made, your
// references and the model's photos — and from here, straight to the other tools.
export function LibraryPage({
  model,
  initialKind = 'found',
  toast,
  onPost,
  onStudio,
  onEdit,
  onReference,
  onSettings,
}: {
  model: Model;
  initialKind?: FolderKind;
  toast: (m: string) => void;
  onPost: (path: string) => void;
  onStudio: (kind: Handoff['kind'], path: string) => void;
  onEdit?: (path: string) => void;
  onReference: (path: string) => Promise<void>;
  onSettings: () => void;
}) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<FolderKind>(initialKind);

  const load = useCallback(async () => {
    try {
      setLibrary(await api.library(model.id));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [model.id]);

  useEffect(() => {
    load();
  }, [load]);

  const folder = library?.[kind];

  const empty =
    kind === 'found' ? 'Nothing found yet' : kind === 'generated' ? 'Nothing made yet' : kind === 'edited' ? 'No edited reels yet' : 'This folder is empty';

  return (
    <div>
      <header className="page-head">
        <h1>Library</h1>
        <div className="page-actions">
          {folder?.connected && (
            <button type="button" className="btn small" onClick={() => api.openFolder(folder.folder).catch((e) => toast(e.message))}>
              <Icon name="external" size={14} />
              Open in Finder
            </button>
          )}
          <button type="button" className="btn small icon" onClick={load} aria-label="Refresh" title="Refresh">
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </header>
      <div className="lib-tabs">
        <div className="segmented" role="tablist" aria-label="Folders">
          {KINDS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              {FOLDER_LABELS[k]}
              {library && library[k].items.length > 0 && <span className="count">{library[k].items.length}</span>}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="notice error">{error}</div>}
      {!library && !error && <p className="muted">Loading…</p>}
      {folder && (
        <section className="card">
          {!folder.connected ? (
            <div className="empty">
              No folder connected yet
              <div>
                <button type="button" className="btn" onClick={onSettings}>
                  <Icon name="folder" size={15} />
                  Connect a folder
                </button>
              </div>
            </div>
          ) : folder.items.length === 0 ? (
            <div className="empty">{empty}</div>
          ) : (
            <LibraryGrid
              model={model}
              items={folder.items}
              renderActions={(item) => {
                const more: MenuAction[] = [
                  {
                    label: 'Use in AI Studio',
                    icon: 'sparkles',
                    onSelect: () => onStudio(item.kind === 'video' ? 'studio-video' : 'studio-photo', item.path),
                  },
                ];
                if (onEdit && item.kind === 'video') more.push({ label: 'Edit', icon: 'scissors', onSelect: () => onEdit(item.path) });
                if (item.kind === 'video' && kind !== 'photos')
                  more.push({
                    label: 'Find more like it',
                    icon: 'radar',
                    onSelect: () => onReference(item.path).catch((e) => toast((e as Error).message)),
                  });
                more.push({ label: 'Show in Finder', icon: 'external', onSelect: () => api.openFolder(item.path).catch((e) => toast(e.message)) });
                return (
                  <>
                    <button type="button" className="btn primary small" onClick={() => onPost(item.path)}>
                      <Icon name="send" size={14} />
                      Post
                    </button>
                    <MoreMenu label={`More for ${item.name}`} actions={more} />
                  </>
                );
              }}
            />
          )}
        </section>
      )}
    </div>
  );
}
