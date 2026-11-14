import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { EditCaptionColor, EditJob, EditOptions, LibraryItem, Model } from '../types';
import type { Handoff } from '../App';
import { api, uploadMusic } from '../api';
import { useLive } from '../live';
import { CtaButton } from '../components/CtaButton';
import { Icon } from '../components/Icon';
import { LibraryPicker } from '../components/LibraryPicker';
import { Dock, Fold, Step } from '../components/Sheet';

type Caption = { text: string; position: string; size: string; style: string; color: string };

const STATUS_LABEL: Record<string, string> = {
  starting: 'Getting ready',
  processing: 'Building',
  saved: 'Done',
  failed: 'Failed',
};

// Caption height as a fraction of the reel height — matches the renderer (editor.CAPTION_SIZES).
const SIZE_SCALE: Record<string, number> = { S: 0.045, M: 0.062, L: 0.085, XL: 0.11 };
const SIZE_LABEL: Record<string, string> = { S: 'Small', M: 'Medium', L: 'Large', XL: 'Huge' };
const STYLE_LABEL: Record<string, string> = { outline: 'Outline', box: 'Chip', plain: 'Shadow' };
const ASPECT_WH: Record<string, [number, number]> = {
  '9:16': [9, 16],
  '4:5': [4, 5],
  '1:1': [1, 1],
  '16:9': [16, 9],
};

function clock(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const t = Math.floor((s * 10) % 10);
  return `${m}:${sec.toString().padStart(2, '0')}.${t}`;
}

// ---- the caption, drawn to look about like the finished reel ----
function captionCss(c: Caption, colors: EditCaptionColor[]): CSSProperties {
  const rgb = colors.find((x) => x.id === c.color)?.rgb ?? [255, 255, 255];
  const col = `rgb(${rgb.join(',')})`;
  const light = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 150;
  const edge = light ? '#111' : '#fff';
  const base: CSSProperties = { color: col, fontSize: `${SIZE_SCALE[c.size] * 100}cqh` };
  if (c.style === 'box') {
    return { ...base, background: 'rgba(0,0,0,.66)', padding: '0.16em 0.5em', borderRadius: '0.3em' };
  }
  if (c.style === 'plain') {
    return { ...base, textShadow: '0.04em 0.05em 0 rgba(0,0,0,.6)' };
  }
  return {
    ...base,
    WebkitTextStroke: `0.09em ${edge}`,
    paintOrder: 'stroke fill',
    textShadow: '0 0.02em 0.12em rgba(0,0,0,.4)',
  } as CSSProperties;
}

function CaptionLayer({ captions, colors }: { captions: Caption[]; colors: EditCaptionColor[] }) {
  return (
    <>
      {captions.map(
        (c, i) =>
          c.text.trim() && (
            <div
              key={i}
              className={`stage-caption ${c.position}`}
              style={c.position === 'middle' ? { top: '50%', transform: 'translateY(-50%)' } : undefined}
            >
              <span style={captionCss(c, colors)}>{c.text}</span>
            </div>
          )
      )}
    </>
  );
}

// ---- the iPhone-style trim bar: a filmstrip, two handles, a playhead ----
function TrimBar({
  duration,
  start,
  end,
  playhead,
  filmstrip,
  onTrim,
  onScrub,
}: {
  duration: number;
  start: number;
  end: number;
  playhead: number;
  filmstrip: string | null;
  onTrim: (start: number, end: number) => void;
  onScrub: (t: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const drag = useRef<null | 'start' | 'end' | 'seek'>(null);
  const pct = (t: number) => `${duration > 0 ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0}%`;

  const timeFromX = useCallback(
    (clientX: number) => {
      const el = barRef.current;
      if (!el || duration <= 0) return 0;
      const rect = el.getBoundingClientRect();
      return Math.min(duration, Math.max(0, ((clientX - rect.left) / rect.width) * duration));
    },
    [duration]
  );

  const apply = useCallback(
    (which: 'start' | 'end' | 'seek', clientX: number) => {
      const t = timeFromX(clientX);
      if (which === 'start') {
        const s = Math.max(0, Math.min(t, end - 0.3));
        onTrim(s, end);
        onScrub(s);
      } else if (which === 'end') {
        const e = Math.min(duration, Math.max(t, start + 0.3));
        onTrim(start, e);
        onScrub(e);
      } else {
        onScrub(Math.min(Math.max(t, start), end));
      }
    },
    [timeFromX, start, end, duration, onTrim, onScrub]
  );

  useEffect(() => {
    const move = (e: PointerEvent) => drag.current && apply(drag.current, e.clientX);
    const up = () => (drag.current = null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [apply]);

  const grab = (which: 'start' | 'end' | 'seek') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current = which;
    apply(which, e.clientX);
  };

  return (
    <div className="trim">
      <div
        className="trim-bar"
        ref={barRef}
        style={filmstrip ? { backgroundImage: `url(${filmstrip})` } : undefined}
        onPointerDown={grab('seek')}
      >
        <div className="trim-dim" style={{ left: 0, width: pct(start) }} />
        <div className="trim-dim" style={{ left: pct(end), right: 0 }} />
        <div className="trim-window" style={{ left: pct(start), right: `calc(100% - ${pct(end)})` }}>
          <div className="trim-handle left" onPointerDown={grab('start')} role="slider" aria-label="Trim start" tabIndex={0}>
            <span />
          </div>
          <div className="trim-handle right" onPointerDown={grab('end')} role="slider" aria-label="Trim end" tabIndex={0}>
            <span />
          </div>
        </div>
        {playhead >= start && playhead <= end && <div className="trim-playhead" style={{ left: pct(playhead) }} />}
      </div>
      <div className="trim-times">
        <span>{clock(start)}</span>
        <span className="muted">keeping {clock(end - start)}</span>
        <span>{clock(end)}</span>
      </div>
    </div>
  );
}

// The Editor: take a clip, trim it, shape it, add captions and music, and save a ready reel.
export function EditPage({
  model,
  handoff,
  toast,
  onPost,
  onSettings,
}: {
  model: Model;
  handoff: Handoff | null;
  toast: (m: string) => void;
  onPost: (path: string) => void;
  onSettings: () => void;
}) {
  const [options, setOptions] = useState<EditOptions | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [natural, setNatural] = useState<[number, number]>([9, 16]);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [aspect, setAspect] = useState('9:16');
  const [fill, setFill] = useState('crop');
  const [mirror, setMirror] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [active, setActive] = useState(0);
  const [music, setMusic] = useState('');
  const [musicList, setMusicList] = useState<{ name: string }[]>([]);
  const [musicVolume, setMusicVolume] = useState(0.8);
  const [keepOriginalAudio, setKeepOriginalAudio] = useState(true);
  const [fade, setFade] = useState(true);
  const [picking, setPicking] = useState(false);
  const [jobs, setJobs] = useState<EditJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const bgRef = useRef<HTMLVideoElement>(null);
  const handled = useRef(0);

  const loadJobs = useCallback(() => {
    api.editJobs(model.id).then(setJobs).catch(() => {});
  }, [model.id]);
  const loadMusic = useCallback(() => {
    api.editMusic(model.id).then(setMusicList).catch(() => {});
  }, [model.id]);

  useEffect(() => {
    api.editOptions().then(setOptions).catch(() => {});
    loadJobs();
    loadMusic();
  }, [loadJobs, loadMusic]);

  const pick = useCallback((path: string) => {
    setSource(path);
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setPlayhead(0);
    setPlaying(false);
    setPicking(false);
  }, []);

  useEffect(() => {
    if (handoff && handoff.at !== handled.current) {
      handled.current = handoff.at;
      pick(handoff.path);
    }
  }, [handoff, pick]);

  useLive((event) => {
    if (event.type !== 'edit_job' || event.model !== model.id) return;
    const job = event.data as EditJob;
    setJobs((list) => {
      const rest = list.filter((j) => j.id !== job.id);
      return [job, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
    if (job.status === 'saved') toast('Reel saved to the Edited folder');
  });

  // ---- preview playback, kept inside the trimmed window ----
  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = t;
    if (bgRef.current) bgRef.current.currentTime = t;
    setPlayhead(t);
    setPlaying(false);
    v?.pause();
    bgRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      bgRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (v.currentTime < trimStart || v.currentTime >= trimEnd - 0.05) v.currentTime = trimStart;
    v.playbackRate = speed;
    if (bgRef.current) {
      bgRef.current.currentTime = v.currentTime;
      bgRef.current.playbackRate = speed;
      bgRef.current.play().catch(() => {});
    }
    v.play().catch(() => {});
    setPlaying(true);
  }, [playing, trimStart, trimEnd, speed]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
    if (bgRef.current) bgRef.current.playbackRate = speed;
  }, [speed, source, fill, aspect]);

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    if (playing && v.currentTime >= trimEnd - 0.03) {
      v.currentTime = trimStart;
      if (bgRef.current) bgRef.current.currentTime = trimStart;
    }
    setPlayhead(v.currentTime);
  }

  function addCaption() {
    if (captions.length >= 5) return;
    const c: Caption = { text: '', position: 'bottom', size: 'L', style: 'outline', color: 'white' };
    setCaptions((list) => [...list, c]);
    setActive(captions.length);
  }
  function setCaption(i: number, patch: Partial<Caption>) {
    setCaptions((list) => list.map((cap, j) => (j === i ? { ...cap, ...patch } : cap)));
  }
  function removeCaption(i: number) {
    setCaptions((list) => list.filter((_, j) => j !== i));
    setActive((a) => Math.max(0, a >= i ? a - 1 : a));
  }

  async function onMusicFile(file: File) {
    try {
      const saved = await uploadMusic(model.id, file);
      loadMusic();
      setMusic(saved.name);
      toast(`Added ${saved.name}`);
    } catch (err) {
      toast((err as Error).message);
    }
  }

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const job = await api.createEdit(model.id, {
        source,
        trimStart,
        trimEnd: trimEnd || duration || null,
        aspect,
        fill,
        mirror,
        speed,
        captions: captions.filter((c) => c.text.trim()),
        music,
        musicVolume,
        keepOriginalAudio,
        fade,
      });
      setJobs((list) => [job, ...list.filter((j) => j.id !== job.id)]);
      toast('Making your reel…');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const colors = options?.captionColors ?? [];
  const aspectWh = aspect === 'original' ? natural : ASPECT_WH[aspect] ?? [9, 16];
  const showBlur = aspect !== 'original' && fill === 'blur';
  const objectFit: CSSProperties['objectFit'] = aspect === 'original' || showBlur ? 'contain' : 'cover';
  const mirrorStyle: CSSProperties = mirror ? { transform: 'scaleX(-1)' } : {};
  const filmstrip = source ? api.editFilmstrip(model.id, source) : null;
  const outLength = (trimEnd - trimStart) / speed;
  const videoUrl = source ? api.libraryFile(model.id, source) : '';

  const ready = !!source && duration > 0;
  const shapeName = aspect === 'original' ? 'Original shape' : aspect;
  const fillName = aspect === 'original' ? '' : fill === 'blur' ? 'fit' : 'fill';
  const usedCaptions = captions.filter((c) => c.text.trim()).length;
  const soundSummary = [music ? `${music}, ${Math.round(musicVolume * 100)}%` : 'No music', fade ? 'fades' : null]
    .filter(Boolean)
    .join(', ');
  const extrasSummary = [speed === 1 ? 'Normal speed' : `${speed}× speed`, mirror ? 'mirrored' : null].filter(Boolean).join(', ');

  return (
    <div>
      <header className="page-head">
        <h1>Editing</h1>
        {source && (
          <div className="facts">
            <span>{source.split('/').pop()}</span>
          </div>
        )}
      </header>

      {picking && (
        <LibraryPicker
          model={model}
          kinds={['found', 'generated', 'edited', 'references']}
          title="Pick a clip to edit"
          videosOnly
          onPick={(item: LibraryItem) => pick(item.path)}
          onClose={() => setPicking(false)}
        />
      )}

      <div className="edit-grid">
        {/* ---------- left: the live reel and its trim bar ---------- */}
        <div className="edit-preview">
          {source ? (
            <div className="edit-stage" style={{ aspectRatio: `${aspectWh[0]} / ${aspectWh[1]}`, '--ar': aspectWh[0] / aspectWh[1] } as CSSProperties}>
              {showBlur && (
                <video ref={bgRef} key={`bg-${source}`} className="stage-blur" src={videoUrl} muted playsInline preload="auto" style={mirrorStyle} />
              )}
              <video
                ref={videoRef}
                key={source}
                className="stage-video"
                src={videoUrl}
                playsInline
                preload="auto"
                style={{ objectFit, ...mirrorStyle }}
                onLoadedMetadata={(e) => {
                  const v = e.target as HTMLVideoElement;
                  const d = v.duration || 0;
                  setDuration(d);
                  setTrimEnd(d);
                  if (v.videoWidth && v.videoHeight) setNatural([v.videoWidth, v.videoHeight]);
                }}
                onTimeUpdate={onTimeUpdate}
                onEnded={() => seek(trimStart)}
                onClick={togglePlay}
              />
              <CaptionLayer captions={captions} colors={colors} />
              <button
                type="button"
                className={`stage-play${playing ? ' playing' : ''}`}
                onClick={togglePlay}
                aria-label={playing ? 'Pause' : 'Play the trimmed part'}
              >
                <Icon name={playing ? 'pause' : 'play'} size={22} />
              </button>
            </div>
          ) : (
            <button type="button" className="stage-empty" onClick={() => setPicking(true)}>
              <span className="dropzone-icon">
                <Icon name="video" size={18} />
              </span>
              <strong>Choose a clip</strong>
              <span className="dropzone-hint">from {model.name}'s folders</span>
            </button>
          )}

          {duration > 0 && (
            <TrimBar
              duration={duration}
              start={trimStart}
              end={trimEnd}
              playhead={playhead}
              filmstrip={filmstrip}
              onTrim={(s, e) => {
                setTrimStart(s);
                setTrimEnd(e);
              }}
              onScrub={seek}
            />
          )}
        </div>

        {/* ---------- right: the steps, in the order you'd do them ---------- */}
        <section className="card sheet">
          <Step
            n={1}
            title="Clip"
            done={ready}
            aside={
              source ? (
                <button type="button" className="btn link small" onClick={() => setPicking(true)}>
                  Change
                </button>
              ) : undefined
            }
          >
            {source ? (
              <div className="facts">
                <span>{clock(duration)} long</span>
                <span>keeping {clock(trimEnd - trimStart)}</span>
              </div>
            ) : (
              <button type="button" className="btn" onClick={() => setPicking(true)}>
                <Icon name="folder" size={15} />
                Choose a clip
              </button>
            )}
          </Step>

          <Step n={2} title="Shape" done={ready}>
            <div className="segmented wide" role="radiogroup" aria-label="Shape">
              {(options?.aspects ?? [{ id: '9:16', name: '9:16' }]).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={aspect === a.id}
                  className={aspect === a.id ? 'on' : ''}
                  onClick={() => setAspect(a.id)}
                  title={a.name}
                >
                  {a.id === 'original' ? 'Original' : a.id}
                </button>
              ))}
            </div>
            {aspect !== 'original' && (
              <div className="segmented" role="radiogroup" aria-label="Fit">
                <button type="button" role="radio" aria-checked={fill === 'crop'} className={fill === 'crop' ? 'on' : ''} onClick={() => setFill('crop')}>
                  Fill, crop the edges
                </button>
                <button type="button" role="radio" aria-checked={fill === 'blur'} className={fill === 'blur' ? 'on' : ''} onClick={() => setFill('blur')}>
                  Fit, blur the edges
                </button>
              </div>
            )}
            <Fold title="Speed and mirror" summary={extrasSummary}>
              <div className="segmented" role="radiogroup" aria-label="Speed">
                {(options?.speeds ?? [0.5, 1, 1.5, 2]).map((sp) => (
                  <button key={sp} type="button" role="radio" aria-checked={speed === sp} className={speed === sp ? 'on' : ''} onClick={() => setSpeed(sp)}>
                    {sp}×
                  </button>
                ))}
              </div>
              <label className="check">
                <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
                <span>Mirror left to right</span>
              </label>
            </Fold>
          </Step>

          <Step
            n={3}
            title="Captions"
            done={usedCaptions > 0}
            aside={
              captions.length < 5 ? (
                <button type="button" className="btn small" onClick={addCaption}>
                  <Icon name="plus" size={14} />
                  Add
                </button>
              ) : undefined
            }
          >
            {captions.length === 0 && <span className="optional">Optional</span>}
            {captions.map((cap, i) => (
              <div key={i} className={`caption-edit${active === i ? ' on' : ''}`} onFocusCapture={() => setActive(i)}>
                <div className="caption-top">
                  <textarea
                    className="short"
                    rows={2}
                    placeholder="Caption text"
                    value={cap.text}
                    onChange={(e) => setCaption(i, { text: e.target.value })}
                    aria-label={`Caption ${i + 1}`}
                  />
                  <button type="button" className="btn small icon" onClick={() => removeCaption(i)} aria-label="Remove caption" title="Remove">
                    <Icon name="x" size={14} />
                  </button>
                </div>
                <Fold
                  title="Look"
                  summary={`${cap.position}, ${(SIZE_LABEL[cap.size] ?? cap.size).toLowerCase()}, ${(STYLE_LABEL[cap.style] ?? cap.style).toLowerCase()}`}
                >
                  <div className="caption-opts">
                    <span className="caption-opt-label">Place</span>
                    <div className="segmented" role="radiogroup" aria-label="Place">
                      {(options?.captionPositions ?? ['top', 'middle', 'bottom']).map((pos) => (
                        <button key={pos} type="button" role="radio" aria-checked={cap.position === pos} className={`cap${cap.position === pos ? ' on' : ''}`} onClick={() => setCaption(i, { position: pos })}>
                          {pos}
                        </button>
                      ))}
                    </div>
                    <span className="caption-opt-label">Size</span>
                    <div className="segmented" role="radiogroup" aria-label="Size">
                      {(options?.captionSizes ?? ['S', 'M', 'L', 'XL']).map((sz) => (
                        <button key={sz} type="button" role="radio" aria-checked={cap.size === sz} className={cap.size === sz ? 'on' : ''} onClick={() => setCaption(i, { size: sz })}>
                          {SIZE_LABEL[sz] ?? sz}
                        </button>
                      ))}
                    </div>
                    <span className="caption-opt-label">Style</span>
                    <div className="segmented" role="radiogroup" aria-label="Style">
                      {(options?.captionStyles ?? ['outline', 'box', 'plain']).map((st) => (
                        <button key={st} type="button" role="radio" aria-checked={cap.style === st} className={cap.style === st ? 'on' : ''} onClick={() => setCaption(i, { style: st })}>
                          {STYLE_LABEL[st] ?? st}
                        </button>
                      ))}
                    </div>
                    <span className="caption-opt-label">Colour</span>
                    <div className="caption-colors">
                      {colors.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`swatch${cap.color === c.id ? ' on' : ''}`}
                          style={{ background: `rgb(${c.rgb.join(',')})` }}
                          aria-label={c.id}
                          aria-pressed={cap.color === c.id}
                          onClick={() => setCaption(i, { color: c.id })}
                        />
                      ))}
                    </div>
                  </div>
                </Fold>
              </div>
            ))}
          </Step>

          <Step n={4} title="Sound" summary={soundSummary} collapsible last>
            <div className="input-row">
              <select value={music} onChange={(e) => setMusic(e.target.value)} aria-label="Music">
                <option value="">No added music</option>
                {musicList.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <label className="btn">
                <Icon name="upload" size={15} />
                Add a track
                <input type="file" accept="audio/*" hidden onChange={(e) => e.target.files?.[0] && onMusicFile(e.target.files[0])} />
              </label>
            </div>
            {music && (
              <>
                <label className="field">
                  <span>
                    Music volume <span className="field-value">{Math.round(musicVolume * 100)}%</span>
                  </span>
                  <input type="range" min={0} max={1.5} step={0.05} value={musicVolume} onChange={(e) => setMusicVolume(+e.target.value)} />
                </label>
                <label className="check">
                  <input type="checkbox" checked={keepOriginalAudio} onChange={(e) => setKeepOriginalAudio(e.target.checked)} />
                  <span>Keep the clip's own sound under the music</span>
                </label>
              </>
            )}
            <label className="check">
              <input type="checkbox" checked={fade} onChange={(e) => setFade(e.target.checked)} />
              <span>Fade in and out</span>
            </label>
          </Step>

          {error && <div className="notice error">{error}</div>}

          <Dock
            info={
              source ? (
                <>
                  <span className="dock-figure">{clock(outLength)}</span>
                  <span className="dock-note">
                    {[shapeName, fillName, usedCaptions ? `${usedCaptions} caption${usedCaptions > 1 ? 's' : ''}` : null].filter(Boolean).join(', ')}
                  </span>
                </>
              ) : (
                <>
                  <span className="dock-figure">No clip yet</span>
                  <span className="dock-note">Saved to {model.name}'s Edited reels</span>
                </>
              )
            }
          >
            <CtaButton
              icon="clapper"
              label={busy ? 'Starting…' : !source ? 'Choose a clip first' : 'Make the reel'}
              win="Ship the reel"
              busy={busy}
              disabled={!source}
              onClick={make}
            />
          </Dock>
        </section>
      </div>

      <section className="card edit-results">
        <div className="card-head">
          <h2>{model.name}'s reels</h2>
          <button type="button" className="btn small" onClick={onSettings}>
            <Icon name="folder" size={14} />
            Folders
          </button>
        </div>
        {jobs.length === 0 ? (
          <div className="empty">Nothing made yet</div>
        ) : (
          <div className="jobs">
            {jobs.map((job) => {
              const working = job.status !== 'saved' && job.status !== 'failed';
              return (
                <div key={job.id} className="job">
                  {job.file ? (
                    <img src={api.libraryThumb(model.id, job.file)} alt="" className="studio-thumb" />
                  ) : (
                    <span className={`studio-thumb empty${working ? ' working' : ''}`} />
                  )}
                  <div className="job-main">
                    <div className="job-head">
                      <span className="job-title">{job.name}</span>
                      <span className={`chip ${job.status === 'saved' ? 'published' : job.status === 'failed' ? 'failed' : 'posting'}`}>
                        {working && <span className="spinner" aria-hidden="true" />}
                        {STATUS_LABEL[job.status] ?? job.status}
                        {job.status === 'processing' && ` ${job.progress}%`}
                      </span>
                    </div>
                    {job.error && <div className="batch-error">{job.error}</div>}
                    {job.file && (
                      <div className="job-actions">
                        <button type="button" className="btn primary small" onClick={() => onPost(job.file!)}>
                          <Icon name="send" size={14} />
                          Post
                        </button>
                        <button type="button" className="btn small" onClick={() => api.openFolder(job.file!).catch((e) => toast(e.message))}>
                          Show
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
