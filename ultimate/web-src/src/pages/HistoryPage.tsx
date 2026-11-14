import { useCallback, useEffect, useState } from 'react';
import type { Batch, Model } from '../types';
import { api } from '../api';
import { BatchCard } from '../components/BatchCard';
import { isActive } from '../batchStatus';
import { Icon } from '../components/Icon';

// What was posted for this model (Fifofarm's History, one model at a time).
export function HistoryPage({ model }: { model: Model }) {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBatches(await api.batches(model.id));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [model.id]);

  useEffect(() => {
    load();
  }, [load]);

  const anyActive = batches?.some(isActive) ?? false;
  useEffect(() => {
    if (!anyActive) return;
    const handle = setInterval(load, 5000);
    return () => clearInterval(handle);
  }, [anyActive, load]);

  return (
    <div>
      <header className="page-head">
        <h1>History</h1>
        <div className="page-actions">
          <button type="button" className="btn small icon" onClick={load} aria-label="Refresh" title="Refresh">
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </header>
      {error && (
        <div className="notice error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      {batches === null && !error && <p className="muted">Loading…</p>}
      {batches?.length === 0 && <div className="empty card">Nothing posted yet</div>}
      {batches?.map((b) => (
        <BatchCard
          key={b.id}
          model={model}
          batch={b}
          onChange={(updated) => setBatches((list) => list?.map((x) => (x.id === updated.id ? updated : x)) ?? null)}
          onDeleted={(id) => setBatches((list) => list?.filter((x) => x.id !== id) ?? null)}
        />
      ))}
    </div>
  );
}
