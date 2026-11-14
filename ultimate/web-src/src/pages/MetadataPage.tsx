import { useCallback, useEffect, useState } from 'react';
import type { MetaFile, Model } from '../types';
import { api } from '../api';
import { formatBytes } from '../format';
import { CtaButton } from '../components/CtaButton';
import { Icon } from '../components/Icon';
import { Dock, Fold, Step } from '../components/Sheet';

const TAG_LABEL: Record<string, string> = {
  location: 'Location',
  device: 'Device',
  date: 'Date',
  'AI/edit tag': 'AI / edit tag',
  other: 'Other data',
};

// Strip the hidden data files carry (camera, GPS, dates, AI/edit tags) before posting. This only
// removes metadata — it never adds fake camera or "shot on" information.
export function MetadataPage({ model, toast, onSettings }: { model: Model; toast: (m: string) => void; onSettings: () => void }) {
  const [files, setFiles] = useState<MetaFile[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFiles(null);
    try {
      const list = await api.metadataFiles(model.id);
      setFiles(list);
      setSelected(new Set(list.filter((f) => !f.clean).map((f) => f.path)));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [model.id]);

  useEffect(() => {
    load();
  }, [load]);

  const needsClean = (files ?? []).filter((f) => !f.clean);
  const alreadyClean = (files ?? []).filter((f) => f.clean);

  function toggle(path: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function clean(paths: string[]) {
    if (paths.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.cleanMetadata(model.id, paths);
      toast(
        res.failed.length
          ? `Cleaned ${res.cleaned.length}, ${res.failed.length} couldn't be done`
          : `Cleaned ${res.cleaned.length} file${res.cleaned.length === 1 ? '' : 's'}`
      );
      if (res.failed.length) setError(res.failed.map((f) => `${f.name}: ${f.error}`).join('\n'));
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const foundTags = [...new Set(needsClean.flatMap((f) => f.tags))].map((t) => (TAG_LABEL[t] ?? t).toLowerCase());
  const n = selected.size;

  return (
    <div>
      <header className="page-head">
        <h1>Metadata</h1>
        <div className="page-actions">
          <button type="button" className="btn small" onClick={load} disabled={busy}>
            <Icon name="refresh" size={14} />
            Scan again
          </button>
        </div>
      </header>

      {error && (
        <div className="notice error" style={{ whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}

      {!files && !error && (
        <section className="card">
          <div className="working row">
            <span className="spinner" aria-hidden="true" />
            <span>Scanning {model.name}'s files…</span>
          </div>
        </section>
      )}

      {files && files.length === 0 && (
        <section className="card">
          <div className="empty">
            No photos or videos in {model.name}'s folders yet
            <div>
              <button type="button" className="btn" onClick={onSettings}>
                <Icon name="folder" size={15} />
                Connect folders
              </button>
            </div>
          </div>
        </section>
      )}

      {files && files.length > 0 && (
        <section className="card sheet">
          <Step
            n={1}
            title="Files with hidden data"
            done={needsClean.length === 0 || n > 0}
            last
            aside={
              needsClean.length > 0 ? (
                <span className="row">
                  <button type="button" className="btn link small" onClick={() => setSelected(new Set(needsClean.map((f) => f.path)))}>
                    All
                  </button>
                  <button type="button" className="btn link small" onClick={() => setSelected(new Set())}>
                    None
                  </button>
                </span>
              ) : undefined
            }
          >
            {needsClean.length === 0 ? (
              <div className="all-clean">
                <span className="all-clean-icon">
                  <Icon name="check" size={16} />
                </span>
                Everything is clean
              </div>
            ) : (
              <div className="meta-list">
                {needsClean.map((f) => (
                  <label key={f.path} className={`meta-row${selected.has(f.path) ? ' on' : ''}`}>
                    <input type="checkbox" checked={selected.has(f.path)} onChange={() => toggle(f.path)} />
                    <img src={api.libraryThumb(model.id, f.path)} alt="" className="meta-thumb" loading="lazy" />
                    <span className="meta-main">
                      <span className="meta-name">{f.name}</span>
                      <span className="facts">
                        {f.folder && <span>{f.folder}</span>}
                        <span>{formatBytes(f.size)}</span>
                      </span>
                    </span>
                    <span className="meta-tags">
                      {f.tags.map((t) => (
                        <span key={t} className="chip warn">
                          {TAG_LABEL[t] ?? t}
                        </span>
                      ))}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {alreadyClean.length > 0 && (
              <Fold title="Already clean" summary={`${alreadyClean.length} file${alreadyClean.length === 1 ? '' : 's'}`}>
                <div className="meta-list">
                  {alreadyClean.map((f) => (
                    <div key={f.path} className="meta-row">
                      <img src={api.libraryThumb(model.id, f.path)} alt="" className="meta-thumb" loading="lazy" />
                      <span className="meta-main">
                        <span className="meta-name">{f.name}</span>
                        <span className="facts">
                          {f.folder && <span>{f.folder}</span>}
                          <span>{formatBytes(f.size)}</span>
                        </span>
                      </span>
                      <span className="chip published">Clean</span>
                    </div>
                  ))}
                </div>
              </Fold>
            )}
          </Step>

          {needsClean.length > 0 && (
            <Dock
              info={
                <>
                  <span className="dock-figure">
                    {n} of {needsClean.length} selected
                  </span>
                  {foundTags.length > 0 && <span className="dock-note">Removes {foundTags.join(', ')}</span>}
                </>
              }
            >
              <CtaButton
                icon="shield"
                label={busy ? 'Cleaning…' : n ? `Clean ${n} file${n === 1 ? '' : 's'}` : 'Pick files to clean'}
                win="Leave no trace"
                busy={busy}
                disabled={n === 0}
                onClick={() => clean([...selected])}
              />
            </Dock>
          )}
        </section>
      )}
    </div>
  );
}
