import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Account, AccountPreview, Batch, MediaJob, Model } from '../types';
import type { Handoff } from '../App';
import { api, uploadMedia } from '../api';
import { AccountAvatar } from '../components/AccountAvatar';
import { BatchCard } from '../components/BatchCard';
import { LibraryPicker } from '../components/LibraryPicker';
import { CtaButton } from '../components/CtaButton';
import { Dock, Fold, Step } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { isActive } from '../batchStatus';
import { formatBytes, formatDuration, toLocalInputValue } from '../format';

// Drafts and ticked accounts are remembered per model.
const draftKey = (modelId: string) => `ultimate.draft.${modelId}`;
const selectionKey = (modelId: string) => `ultimate.unselected.${modelId}`;
const TITLE_PLATFORMS = new Set(['youtube', 'pinterest', 'facebook']);

// Each photo or video you add is one slot. One slot posts as a photo or a video; two or more post as a
// carousel, in the order shown.
type Slot =
  | { key: string; phase: 'uploading'; name: string; fraction: number }
  | { key: string; phase: 'processing'; name: string; job: MediaJob }
  | { key: string; phase: 'ready'; name: string; job: MediaJob }
  | { key: string; phase: 'failed'; name: string; error: string };
type UploadingSlot = Extract<Slot, { phase: 'uploading' }>;

let slotCounter = 0;
const newKey = () => `slot-${Date.now().toString(36)}-${(slotCounter++).toString(36)}`;

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode); drafts just won't persist
  }
}

export function ComposePage({
  model,
  handoff,
  onGoAccounts,
  onGoLibrary,
}: {
  model: Model;
  handoff: Handoff | null;
  onGoAccounts: () => void;
  onGoLibrary: () => void;
}) {
  const [draft] = useState(() => readStorage(draftKey(model.id), { caption: '', title: '' }));
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Remember who you *unticked*, so newly connected accounts start ticked.
  const [unselected, setUnselected] = useState<Set<string>>(
    () => new Set(readStorage<string[]>(selectionKey(model.id), []))
  );
  const [caption, setCaption] = useState<string>(draft.caption);
  const [title, setTitle] = useState<string>(draft.title);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [scheduleAt, setScheduleAt] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [preview, setPreview] = useState<Record<string, AccountPreview>>({});
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [result, setResult] = useState<Batch | null>(null);
  const [picking, setPicking] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .accounts(model.id)
      .then(setAccounts)
      .catch((err) => setLoadError(err.message));
  }, [model.id]);

  useEffect(() => writeStorage(draftKey(model.id), { caption, title }), [model.id, caption, title]);
  useEffect(() => writeStorage(selectionKey(model.id), [...unselected]), [model.id, unselected]);

  const readyIds = slots.flatMap((s) => (s.phase === 'ready' ? [s.job.id] : []));
  const readyKey = readyIds.join(',');
  const preparing = slots.some((s) => s.phase === 'uploading' || s.phase === 'processing');
  const failedSlots = slots.filter((s) => s.phase === 'failed');
  const mediaReady = slots.length > 0 && readyIds.length === slots.length;
  const isCarousel = slots.length > 1;

  // Ask the server what would happen per account (length, shortening, problems).
  useEffect(() => {
    if (!accounts?.length) return;
    const handle = setTimeout(() => {
      api
        .preview(model.id, { caption, captions: overrides, mediaIds: readyKey ? readyKey.split(',') : [] })
        .then(setPreview)
        .catch(() => {});
    }, 300);
    return () => clearTimeout(handle);
  }, [model.id, accounts, caption, overrides, readyKey]);

  const usable = useMemo(() => (accounts ?? []).filter((a) => a.supported && !a.disabled), [accounts]);
  const selected = usable.filter((a) => !unselected.has(a.id));
  const ready = selected.filter((a) => (preview[a.id]?.problems.length ?? 0) === 0);
  const skipped = selected.filter((a) => (preview[a.id]?.problems.length ?? 0) > 0);
  const needsTitle = selected.some((a) => TITLE_PLATFORMS.has(a.identifier));
  // "All Instagram", "All TikTok", ... — handy with many accounts per network.
  const networkGroups = useMemo(() => {
    const map = new Map<string, { identifier: string; name: string; ids: string[] }>();
    for (const a of usable) {
      const g = map.get(a.identifier) ?? { identifier: a.identifier, name: a.platform, ids: [] };
      g.ids.push(a.id);
      map.set(a.identifier, g);
    }
    return [...map.values()];
  }, [usable]);

  function toggle(id: string) {
    setUnselected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const setSlot = useCallback(
    (key: string, next: Slot) => setSlots((prev) => prev.map((s) => (s.key === key ? next : s))),
    []
  );

  const pollJob = useCallback(
    (key: string, job: MediaJob) => {
      const tick = async () => {
        try {
          const latest = await api.mediaJob(job.id);
          if (latest.status === 'ready') setSlot(key, { key, phase: 'ready', name: latest.name, job: latest });
          else if (latest.status === 'failed')
            setSlot(key, { key, phase: 'failed', name: latest.name, error: latest.error ?? 'Failed' });
          else {
            setSlot(key, { key, phase: 'processing', name: latest.name, job: latest });
            setTimeout(tick, 1000);
          }
        } catch (err) {
          setSlot(key, { key, phase: 'failed', name: job.name, error: (err as Error).message });
        }
      };
      tick();
    },
    [setSlot]
  );

  // Files from the model's library (Reel Finder finds, AI Studio photos and videos…): no upload needed.
  const addLibraryFiles = useCallback(
    (paths: string[], replace = false) => {
      if (!paths.length) return;
      setResult(null);
      const fresh: UploadingSlot[] = paths.map((path) => ({
        key: newKey(),
        phase: 'uploading',
        name: path.split('/').pop() || 'file',
        fraction: 1,
      }));
      setSlots((prev) => [...(replace ? [] : prev), ...fresh]);
      fresh.forEach(async (slot, i) => {
        try {
          const job = await api.localMedia(model.id, paths[i]);
          setSlot(slot.key, { key: slot.key, phase: 'processing', name: slot.name, job });
          pollJob(slot.key, job);
        } catch (err) {
          setSlot(slot.key, { key: slot.key, phase: 'failed', name: slot.name, error: (err as Error).message });
        }
      });
    },
    [model.id, pollJob, setSlot]
  );

  // Another tool sent a file here ("Post" on a Reel Finder find, the library or AI Studio).
  const handled = useRef(0);
  useEffect(() => {
    if (handoff && handoff.at !== handled.current) {
      handled.current = handoff.at;
      addLibraryFiles([handoff.path], true);
    }
  }, [handoff, addLibraryFiles]);

  function addFiles(files: File[]) {
    if (!files.length) return;
    setResult(null);
    const fresh: UploadingSlot[] = files.map((file) => ({ key: newKey(), phase: 'uploading', name: file.name, fraction: 0 }));
    setSlots((prev) => [...prev, ...fresh]);
    fresh.forEach(async (slot, i) => {
      try {
        const job = await uploadMedia(files[i], (fraction) => setSlot(slot.key, { ...slot, fraction }));
        setSlot(slot.key, { key: slot.key, phase: 'processing', name: slot.name, job });
        pollJob(slot.key, job);
      } catch (err) {
        setSlot(slot.key, { key: slot.key, phase: 'failed', name: slot.name, error: (err as Error).message });
      }
    });
  }

  function removeSlot(key: string) {
    setSlots((prev) => prev.filter((s) => s.key !== key));
  }

  function moveSlot(key: string, delta: number) {
    setSlots((prev) => {
      const from = prev.findIndex((s) => s.key === key);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [slot] = next.splice(from, 1);
      next.splice(to, 0, slot);
      return next;
    });
  }

  function moveSlotTo(key: string, targetKey: string) {
    setSlots((prev) => {
      const from = prev.findIndex((s) => s.key === key);
      const to = prev.findIndex((s) => s.key === targetKey);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [slot] = next.splice(from, 1);
      next.splice(to, 0, slot);
      return next;
    });
  }

  async function submit() {
    setPosting(true);
    setPostError(null);
    try {
      const batch = await api.post(model.id, {
        caption,
        title,
        mediaIds: readyIds,
        accountIds: ready.map((a) => a.id),
        scheduleAt: when === 'later' ? new Date(scheduleAt).toISOString() : null,
        captions: Object.fromEntries(Object.entries(overrides).filter(([id]) => ready.some((a) => a.id === id))),
      });
      setResult(batch);
    } catch (err) {
      setPostError((err as Error).message);
    } finally {
      setPosting(false);
    }
  }

  function startOver() {
    setResult(null);
    setCaption('');
    setTitle('');
    setOverrides({});
    setSlots([]);
    setWhen('now');
  }

  // Live status of what was just posted.
  useEffect(() => {
    if (!result || !isActive(result)) return;
    const started = Date.now();
    const handle = setInterval(async () => {
      try {
        const fresh = await api.batch(model.id, result.id);
        setResult(fresh);
        if (!isActive(fresh) || Date.now() - started > 30 * 60 * 1000) clearInterval(handle);
      } catch {
        // keep trying; a blip shouldn't stop the status updates
      }
    }, 3000);
    return () => clearInterval(handle);
  }, [result?.id, result && isActive(result)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (result) {
    const anyActive = isActive(result);
    return (
      <div>
        <header className="page-head">
          <h1>{anyActive ? 'Posting…' : result.scheduleAt ? 'Scheduled' : 'Posted'}</h1>
          <div className="page-actions">
            <button className="btn primary" onClick={startOver}>
              <Icon name="plus" size={15} />
              New post
            </button>
          </div>
        </header>
        <BatchCard model={model} batch={result} onChange={setResult} onDeleted={startOver} />
      </div>
    );
  }

  const canPost =
    !posting &&
    ready.length > 0 &&
    !preparing &&
    failedSlots.length === 0 &&
    (mediaReady || (slots.length === 0 && caption.trim().length > 0));
  const blocker = preparing
    ? isCarousel
      ? 'Preparing your carousel…'
      : 'Preparing your file…'
    : failedSlots.length > 0
      ? 'Remove the files that failed'
      : slots.length === 0 && !caption.trim()
        ? 'Add a photo, video or caption'
        : ready.length === 0
        ? selected.length === 0
          ? 'Choose accounts to post to'
          : 'Fix the red notes first'
        : null;
  const plural = ready.length === 1 ? '' : 's';
  const readyResults = slots.flatMap((s) => (s.phase === 'ready' && s.job.result ? [s.job.result] : []));
  const videoCount = readyResults.filter((r) => r.kind === 'video').length;
  const photoCount = readyResults.length - videoCount;
  const single = slots.length === 1 ? slots[0] : null;
  const singleResult = single?.phase === 'ready' ? single.job.result : null;
  const pickFiles = () => fileInput.current?.click();
  const dropFiles = (e: React.DragEvent) => {
    if (!e.dataTransfer.files.length) return; // a slide being dragged, not a file
    e.preventDefault();
    setDragOver(false);
    addFiles([...e.dataTransfer.files]);
  };
  const changed = Object.keys(overrides).length;
  const whenText = new Date(scheduleAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <header className="page-head">
        <h1>New post</h1>
      </header>
      {picking && (
        <LibraryPicker
          model={model}
          kinds={['found', 'generated', 'edited', 'photos', 'references']}
          title="Choose from the library"
          onPick={(item) => {
            setPicking(false);
            addLibraryFiles([item.path]);
          }}
          onPickMany={(items) => {
            setPicking(false);
            addLibraryFiles(items.map((i) => i.path));
          }}
          onClose={() => setPicking(false)}
          onGoLibrary={onGoLibrary}
        />
      )}
      <section className="card sheet">
        <Step
          n={1}
          title={isCarousel ? 'Carousel' : 'Photo or video'}
          done={mediaReady}
          aside={
            <button className="btn small" onClick={() => setPicking(true)}>
              <Icon name="folder" size={14} />
              {slots.length ? 'Add from library' : `From ${model.name}'s library`}
            </button>
          }
        >
          {slots.length === 0 ? (
            <div
              className={`drop${dragOver ? ' over' : ''}`}
              role="button"
              tabIndex={0}
              onClick={pickFiles}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pickFiles()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={dropFiles}
            >
              <span className="dropzone-icon" aria-hidden="true">
                <Icon name="upload" size={18} />
              </span>
              <strong>Drop photos or a video here</strong>
              <span className="dropzone-hint">Add two or more to post a carousel</span>
            </div>
          ) : single ? (
            <>
              {single.phase === 'uploading' ? (
                <div className="working">
                  <div className="row">
                    <strong>{single.fraction >= 1 ? `Opening ${single.name}` : `Uploading ${single.name}`}</strong>
                    <span className="spacer" />
                    <span className="muted">{Math.round(single.fraction * 100)}%</span>
                  </div>
                  <div className="progress">
                    <div style={{ width: `${single.fraction * 100}%` }} />
                  </div>
                </div>
              ) : single.phase === 'processing' ? (
                <div className="working">
                  <div className="row">
                    <strong>{single.job.step}…</strong>
                    <span className="spacer" />
                    <span className="muted">{single.job.progress}%</span>
                  </div>
                  <div className="progress">
                    <div style={{ width: `${single.job.progress}%` }} />
                  </div>
                </div>
              ) : single.phase === 'failed' ? (
                <div className="notice error row">
                  <span style={{ flex: 1 }}>
                    {single.name}: {single.error}
                  </span>
                  <button className="btn small" onClick={() => removeSlot(single.key)}>
                    Remove
                  </button>
                </div>
              ) : (
                <div className="media-ready">
                  {singleResult?.previewUrl && <img src={singleResult.previewUrl} alt="" />}
                  <div className="media-ready-main">
                    <strong>{single.job.name}</strong>
                    <div className="facts">
                      {singleResult?.kind === 'video' ? (
                        <>
                          <span>{formatDuration(singleResult.durationSeconds ?? 0)}</span>
                          <span>
                            {singleResult.width}×{singleResult.height}
                          </span>
                          <span>{formatBytes(singleResult.sizeBytes)}</span>
                        </>
                      ) : (
                        <span>
                          Photo, {singleResult?.width}×{singleResult?.height}
                        </span>
                      )}
                      {singleResult?.reencoded && <span>converted for all networks</span>}
                    </div>
                  </div>
                  <button className="btn small" onClick={() => removeSlot(single.key)}>
                    Remove
                  </button>
                </div>
              )}
              {single.phase !== 'failed' && (
                <div className="row">
                  <button className="btn small" onClick={pickFiles}>
                    <Icon name="plus" size={14} />
                    Add more for a carousel
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div
                className={`slides${dragOver ? ' over' : ''}`}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('Files')) {
                    e.preventDefault();
                    setDragOver(true);
                  }
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={dropFiles}
              >
                {slots.map((slot, i) => {
                  const res = slot.phase === 'ready' ? slot.job.result : null;
                  const fraction =
                    slot.phase === 'uploading' ? slot.fraction : slot.phase === 'processing' ? slot.job.progress / 100 : 1;
                  return (
                    <div
                      key={slot.key}
                      className={`slide${slot.phase === 'failed' ? ' failed' : ''}${dragKey === slot.key ? ' dragging' : ''}`}
                      draggable
                      onDragStart={(e) => {
                        setDragKey(slot.key);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnter={() => dragKey && dragKey !== slot.key && moveSlotTo(dragKey, slot.key)}
                      onDragOver={(e) => dragKey && e.preventDefault()}
                      onDragEnd={() => setDragKey(null)}
                      title={slot.name}
                    >
                      <span className="slide-thumb">
                        {res?.previewUrl ? (
                          <img src={res.previewUrl} alt="" draggable={false} />
                        ) : slot.phase === 'failed' ? (
                          <Icon name="x" size={18} />
                        ) : (
                          <span className="spinner" aria-hidden="true" />
                        )}
                        {res?.kind === 'video' && (
                          <span className="slide-badge">
                            <Icon name="play" size={9} />
                            {formatDuration(res.durationSeconds ?? 0)}
                          </span>
                        )}
                        {(slot.phase === 'uploading' || slot.phase === 'processing') && (
                          <span className="slide-progress">
                            <span style={{ width: `${Math.round(fraction * 100)}%` }} />
                          </span>
                        )}
                      </span>
                      <span className="slide-num">{i + 1}</span>
                      <button type="button" className="slide-remove" aria-label={`Remove ${slot.name}`} onClick={() => removeSlot(slot.key)}>
                        <Icon name="x" size={12} />
                      </button>
                      <span className="slide-move">
                        <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => moveSlot(slot.key, -1)}>
                          <Icon name="chevron" size={13} className="flip" />
                        </button>
                        <button type="button" aria-label="Move later" disabled={i === slots.length - 1} onClick={() => moveSlot(slot.key, 1)}>
                          <Icon name="chevron" size={13} />
                        </button>
                      </span>
                    </div>
                  );
                })}
                <button type="button" className="slide slide-add" onClick={pickFiles} aria-label="Add photos or videos">
                  <Icon name="plus" size={18} />
                  <span>Add</span>
                </button>
              </div>
              <div className="facts">
                {photoCount > 0 && <span>{photoCount === 1 ? '1 photo' : `${photoCount} photos`}</span>}
                {videoCount > 0 && <span>{videoCount === 1 ? '1 video' : `${videoCount} videos`}</span>}
                <span>Drag to change the order</span>
              </div>
              {failedSlots.map((slot) => (
                <div key={slot.key} className="notice error">
                  {slot.name}: {slot.phase === 'failed' ? slot.error : ''}
                </div>
              ))}
            </>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="video/*,image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              addFiles(files);
            }}
          />
        </Step>

        <Step n={2} title="Caption" done={caption.trim().length > 0}>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write your caption and #hashtags"
            aria-label="Caption"
          />
          {needsTitle && (
            <label className="field">
              <span>Title</span>
              <input type="text" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
            </label>
          )}
          {selected.length > 1 && (
            <Fold title="A different caption for some accounts" summary={changed ? `${changed} changed` : 'Same everywhere'}>
              {selected.map((a) => (
                <label className="field" key={a.id}>
                  <span>
                    {a.name}
                    <span className="field-value">{a.platform}</span>
                  </span>
                  <textarea
                    className="short"
                    value={overrides[a.id] ?? ''}
                    placeholder="Same as the main caption"
                    onChange={(e) =>
                      setOverrides((prev) => {
                        const next = { ...prev };
                        if (e.target.value === '') delete next[a.id];
                        else next[a.id] = e.target.value;
                        return next;
                      })
                    }
                  />
                </label>
              ))}
            </Fold>
          )}
        </Step>

        <Step
          n={3}
          title="Accounts"
          done={ready.length > 0}
          aside={
            usable.length > 1 && (
              <>
                <button className="btn link small" onClick={() => setUnselected(new Set())}>
                  All
                </button>
                <button className="btn link small" onClick={() => setUnselected(new Set(usable.map((a) => a.id)))}>
                  None
                </button>
              </>
            )
          }
        >
          {networkGroups.length > 1 && (
            <div className="network-chips" role="group" aria-label="Select a whole network">
              {networkGroups.map((g) => {
                const allOn = g.ids.every((id) => !unselected.has(id));
                return (
                  <button
                    key={g.identifier}
                    className={`network-chip${allOn ? ' on' : ''}`}
                    aria-pressed={allOn}
                    onClick={() =>
                      setUnselected((prev) => {
                        const next = new Set(prev);
                        for (const id of g.ids) {
                          if (allOn) next.add(id);
                          else next.delete(id);
                        }
                        return next;
                      })
                    }
                  >
                    {g.name}
                    <span className="count">{g.ids.length}</span>
                  </button>
                );
              })}
            </div>
          )}
          {loadError && <div className="notice error">{loadError}</div>}
          {accounts === null && !loadError && <p className="muted">Loading accounts…</p>}
          {accounts?.length === 0 && (
            <div className="empty">
              <p>{model.name} has no accounts yet.</p>
              <button className="btn primary" onClick={onGoAccounts}>
                Add {model.name}'s accounts
              </button>
            </div>
          )}
          <div className="account-list">
            {(accounts ?? []).map((a) => {
              const p = preview[a.id];
              const isUsable = a.supported && !a.disabled;
              const isSelected = isUsable && !unselected.has(a.id);
              const blocked = isSelected && (p?.problems.length ?? 0) > 0;
              return (
                <label
                  key={a.id}
                  className={`account${isUsable ? ' selectable' : ' blocked'}${isSelected && !blocked ? ' selected' : ''}${
                    blocked ? ' blocked' : ''
                  }`}
                >
                  <input type="checkbox" checked={isSelected} disabled={!isUsable} onChange={() => toggle(a.id)} />
                  <AccountAvatar name={a.name} picture={a.picture} identifier={a.identifier} />
                  <span className="account-main">
                    <span className="account-name">{a.name}</span>
                    <span className="account-meta">
                      {a.platform}
                      {!a.supported && ', post to this one from Postiz'}
                      {a.disabled && ', disabled in the posting engine'}
                    </span>
                    {isSelected && p?.problems.map((msg) => <span key={msg} className="batch-error">{msg}</span>)}
                    {isSelected &&
                      p?.warnings.map((msg) => (
                        <span key={msg} className="account-warn">
                          {msg}
                        </span>
                      ))}
                  </span>
                  {isSelected && p && p.max > 0 && (
                    <span className="account-side">
                      <span className={p.over ? 'account-warn' : 'muted'}>
                        {p.length}/{p.max}
                      </span>
                      {p.willShorten && <span className="account-warn">will be shortened</span>}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </Step>

        <Step n={4} title="When" done last>
          <div className="segmented" role="group" aria-label="When to post">
            <button className={when === 'now' ? 'on' : ''} onClick={() => setWhen('now')}>
              Right now
            </button>
            <button className={when === 'later' ? 'on' : ''} onClick={() => setWhen('later')}>
              Schedule
            </button>
          </div>
          {when === 'later' && (
            <label className="field">
              <span>Date and time</span>
              <input
                type="datetime-local"
                value={scheduleAt}
                min={toLocalInputValue(new Date())}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
            </label>
          )}
        </Step>

        {skipped.length > 0 && (
          <div className="notice warn">
            {skipped.length === 1 ? '1 selected account will be skipped' : `${skipped.length} selected accounts will be skipped`}. See the red
            notes in step 3.
          </div>
        )}
        {postError && <div className="notice error">{postError}</div>}

        <Dock
          info={
            <>
              <span className="dock-figure">{ready.length ? `${ready.length} account${plural}` : 'No accounts yet'}</span>
              <span className="dock-note">{when === 'now' ? 'Goes out right now' : `Goes out ${whenText}`}</span>
            </>
          }
        >
          <CtaButton
            icon={when === 'now' ? 'send' : 'calendar'}
            label={
              posting
                ? 'Sending…'
                : blocker ?? `${when === 'now' ? 'Post' : 'Schedule'}${isCarousel ? ' carousel' : ''} to ${ready.length} account${plural}`
            }
            win={when === 'now' ? 'Send it live' : 'Set it and forget it'}
            busy={posting}
            disabled={!canPost}
            onClick={submit}
          />
        </Dock>
      </section>
    </div>
  );
}
