import { useState } from 'react';
import type { LibraryItem, Model, PromptResult } from '../types';
import { api } from '../api';
import { CtaButton } from '../components/CtaButton';
import { Icon } from '../components/Icon';
import { LibraryPicker } from '../components/LibraryPicker';
import { Dock, Fold, Step } from '../components/Sheet';

// Prompt Making: pick one of this model's reference/found videos and turn it into a ready-to-generate
// text-to-video prompt (via the same local vision model Reel Finder uses). Paste it into AI Studio's
// Wan model — in "From a photo" mode from this model's photo — to recreate the clip as your model,
// at a plain 1× generation price instead of a 2× video-to-video edit.

// The structured fields, in the order they read best. "prompt" and "negative" get their own blocks.
const FIELDS: { key: keyof PromptResult['prompt']; label: string }[] = [
  { key: 'subject', label: 'Subject' },
  { key: 'wardrobe', label: 'Wardrobe' },
  { key: 'setting', label: 'Setting' },
  { key: 'lighting', label: 'Lighting' },
  { key: 'action', label: 'Action' },
  { key: 'camera', label: 'Camera' },
  { key: 'style', label: 'Style' },
  { key: 'mood', label: 'Mood' },
  { key: 'pacing', label: 'Pacing' },
  { key: 'audio', label: 'Audio' },
];

export function PromptMakerPage({
  model,
  toast,
  onUseInStudio,
}: {
  model: Model;
  toast: (m: string) => void;
  onUseInStudio: (prompt: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [video, setVideo] = useState<LibraryItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PromptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`);
    } catch {
      toast("Couldn't copy — select it and copy by hand.");
    }
  }

  async function make() {
    if (!video || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.makePrompt(model.id, video.path));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const p = result?.prompt;
  const parts = p ? FIELDS.filter((f) => p[f.key]) : [];

  return (
    <div>
      {picking && (
        <LibraryPicker
          model={model}
          kinds={['found', 'references', 'generated']}
          title={`Pick a reference video for ${model.name}`}
          videosOnly
          onPick={(item) => {
            setVideo(item);
            setResult(null);
            setError(null);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}

      <header className="page-head">
        <h1>Prompt Making</h1>
      </header>

      <section className="card sheet">
        <Step
          n={1}
          title="Pick a video"
          done={!!video}
          aside={
            video ? (
              <button type="button" className="btn link small" onClick={() => setPicking(true)} disabled={busy}>
                Change
              </button>
            ) : undefined
          }
        >
          {video ? (
            <div className="media-ready">
              <img src={api.libraryThumb(model.id, video.path)} alt="" />
              <div className="media-ready-main">
                <strong>{video.name}</strong>
                {video.folder && <span className="muted small">{video.folder}</span>}
              </div>
            </div>
          ) : (
            <button type="button" className="drop pick" onClick={() => setPicking(true)}>
              <span className="dropzone-icon">
                <Icon name="folder" size={18} />
              </span>
              <strong>Choose a video</strong>
              <span className="dropzone-hint">from {model.name}'s folders</span>
            </button>
          )}
        </Step>

        <Step
          n={2}
          title="The prompt"
          done={!!p}
          last
          aside={
            p ? (
              <span className="facts">
                <span>{result?.model || 'local model'}</span>
                {result?.seconds ? <span>{result.seconds}s clip</span> : null}
              </span>
            ) : undefined
          }
        >
          {busy && (
            <div className="working row">
              <span className="spinner" aria-hidden="true" />
              <span>Reading the video…</span>
            </div>
          )}
          {error && <div className="notice error">{error}</div>}
          {p && (
            <>
              {result?.warning && <div className="notice warn">{result.warning}</div>}
              <textarea className="prompt-out" readOnly rows={7} value={p.prompt} aria-label="Prompt" />
              <div className="row">
                <button type="button" className="btn small" onClick={() => copy(p.prompt, 'Prompt')}>
                  <Icon name="copy" size={15} />
                  Copy
                </button>
              </div>
              {p.negative && (
                <Fold title="Things to avoid" summary={p.negative}>
                  <textarea className="prompt-out short" readOnly rows={2} value={p.negative} aria-label="Things to avoid" />
                  <div className="row">
                    <button type="button" className="btn small" onClick={() => copy(p.negative, 'Negative')}>
                      <Icon name="copy" size={15} />
                      Copy
                    </button>
                  </div>
                </Fold>
              )}
              <Fold title="Breakdown" summary={`${parts.length} parts`}>
                <dl className="prompt-grid">
                  {parts.map((f) => (
                    <div key={f.key} className="prompt-row">
                      <dt className="muted small">{f.label}</dt>
                      <dd className="small">{p[f.key]}</dd>
                    </div>
                  ))}
                </dl>
                <div className="row">
                  <button type="button" className="btn small" onClick={() => copy(JSON.stringify(p, null, 2), 'JSON')}>
                    <Icon name="copy" size={15} />
                    Copy all as JSON
                  </button>
                </div>
              </Fold>
            </>
          )}
        </Step>

        <Dock
          info={
            p ? (
              <>
                <span className="dock-figure">Prompt ready</span>
                <span className="dock-note">Next: AI Studio</span>
              </>
            ) : (
              <>
                <span className="dock-figure">Free</span>
                <span className="dock-note">Runs on your local AI model</span>
              </>
            )
          }
        >
          {p ? (
            <>
              <button type="button" className="btn" onClick={make}>
                Write it again
              </button>
              <CtaButton icon="sparkles" label="Use in AI Studio" win={`Make it ${model.name}'s`} onClick={() => onUseInStudio(p.prompt)} />
            </>
          ) : (
            <CtaButton
              icon="wand"
              label={busy ? 'Reading the video…' : video ? 'Write the prompt' : 'Pick a video first'}
              win="Crack the formula"
              busy={busy}
              disabled={!video}
              onClick={make}
            />
          )}
        </Dock>
      </section>
    </div>
  );
}
