import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Model, StudioJob, StudioSpending } from '../types';
import { api } from '../api';
import { useLive } from '../live';
import { Icon } from '../components/Icon';

function useMoney(currency: string) {
  return (n: number) => `${currency === 'USD' ? '$' : ''}${n.toFixed(2)}${currency && currency !== 'USD' ? ` ${currency}` : ''}`;
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

// How much this one model has spent on Wan (AI Studio). Switch the period between the all-time total
// and any single month. Wan bills per second of finished video, and only for videos that succeed.
export function SpendingPage({ model, onSettings }: { model: Model; onSettings: () => void }) {
  const [sum, setSum] = useState<StudioSpending | null>(null);
  const [jobs, setJobs] = useState<StudioJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('total'); // 'total' or a 'YYYY-MM' key

  const load = useCallback(async () => {
    try {
      const [s, j] = await Promise.all([api.studioSpending(model.id), api.studioJobs(model.id)]);
      setSum(s);
      setJobs(j.filter((x) => x.status === 'saved' && x.cost != null));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [model.id]);

  useEffect(() => {
    load();
  }, [load]);

  useLive((event) => {
    if (event.type === 'studio_job' && event.model === model.id) load();
  });

  const money = useMoney(sum?.currency ?? 'USD');

  // Group this model's finished videos by month, newest first, for the period selector + per-month totals.
  const months = useMemo(() => {
    const m = new Map<string, { cost: number; videos: number; seconds: number }>();
    for (const j of jobs) {
      const key = monthKey(j.createdAt);
      const e = m.get(key) ?? { cost: 0, videos: 0, seconds: 0 };
      e.cost += j.cost ?? 0;
      e.videos += 1;
      e.seconds += j.seconds ?? 0;
      m.set(key, e);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [jobs]);

  const isMonth = period !== 'total';
  const selected = months.find(([k]) => k === period)?.[1];
  const stats = isMonth
    ? { total: selected?.cost ?? 0, videos: selected?.videos ?? 0, seconds: selected?.seconds ?? 0 }
    : { total: sum?.total ?? 0, videos: sum?.videos ?? 0, seconds: sum?.seconds ?? 0 };

  const shownJobs = isMonth ? jobs.filter((j) => monthKey(j.createdAt) === period) : jobs;
  const maxMonth = Math.max(1, ...months.map(([, m]) => m.cost));

  return (
    <div>
      <header className="page-head">
        <h1>Spending</h1>
        <div className="page-actions">
          <label className="row small" style={{ gap: 6, alignItems: 'center' }}>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Spending period">
              <option value="total">All time</option>
              {months.map(([key]) => (
                <option key={key} value={key}>
                  {monthLabel(key)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn small icon" onClick={load} aria-label="Refresh" title="Refresh">
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </header>

      {error && <div className="notice error">{error}</div>}

      <section className="card">
        <div className="spend-tiles">
          <div className="spend-tile">
            <div className="spend-big">{sum ? money(stats.total) : '—'}</div>
            <div className="muted small">{isMonth ? `Spent in ${monthLabel(period)}` : 'Total on Wan'}</div>
          </div>
          <div className="spend-tile">
            <div className="spend-big">{stats.videos}</div>
            <div className="muted small">Videos made</div>
          </div>
          <div className="spend-tile">
            <div className="spend-big">{Math.round(stats.seconds)}s</div>
            <div className="muted small">Video generated</div>
          </div>
          <div className="spend-tile">
            <div className="spend-big">{stats.videos ? money(stats.total / stats.videos) : '—'}</div>
            <div className="muted small">Average per video</div>
          </div>
        </div>
        <div className="spend-foot">
          <button type="button" className="btn link small" onClick={onSettings}>
            Rates
          </button>
        </div>
      </section>

      {!isMonth && months.length > 0 && (
        <section className="card">
          <h2>By month</h2>
          <div className="spend-bars">
            {months.map(([key, mo]) => (
              <button key={key} type="button" className="spend-bar-row" onClick={() => setPeriod(key)} title={`See ${monthLabel(key)}`}>
                <span className="spend-bar-label small">{monthLabel(key)}</span>
                <span className="spend-bar-track">
                  <span className="spend-bar-fill" style={{ width: `${(100 * mo.cost) / maxMonth}%` }} />
                </span>
                <span className="spend-bar-value small">
                  {money(mo.cost)} <span className="muted">{mo.videos} {mo.videos === 1 ? 'video' : 'videos'}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!isMonth && sum && Object.keys(sum.perResolution).length > 0 && (
        <section className="card">
          <h2>By quality</h2>
          <table className="spend-table">
            <thead>
              <tr>
                <th>Quality</th>
                <th>Videos</th>
                <th>Seconds</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(sum.perResolution).map(([res, r]) => (
                <tr key={res}>
                  <td>{res}</td>
                  <td>{r.videos}</td>
                  <td>{Math.round(r.seconds)}s</td>
                  <td>{money(r.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h2>{isMonth ? `Videos in ${monthLabel(period)}` : 'Every video'}</h2>
        {shownJobs.length === 0 ? (
          <p className="muted small">Nothing yet.</p>
        ) : (
          <div className="stack">
            {shownJobs.map((job) => (
              <div key={job.id} className="row spend-item">
                <span className="small">{new Date(job.createdAt).toLocaleDateString()}</span>
                <span className="facts">
                  <span>{job.resolution}</span>
                  <span>{job.seconds ?? '?'}s</span>
                  <span>{job.mode === 'text' ? 'prompt' : job.mode === 'image' ? 'photo' : 'reference'}</span>
                </span>
                <span className="small" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {job.prompt || (job.videos[0] ? job.videos[0].split('/').pop() : '')}
                </span>
                <strong className="small">{money(job.cost ?? 0)}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
