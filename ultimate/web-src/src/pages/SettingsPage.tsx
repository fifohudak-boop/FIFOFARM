import { useCallback, useEffect, useState } from 'react';
import type { Account, AppStatus, FolderKind, Model, ModelStudioKey, ProviderKeyInfo, ProviderMeta, Person, Preferences } from '../types';
import { api } from '../api';
import { AccountAvatar } from '../components/AccountAvatar';
import { EngineSetup } from '../components/EngineSetup';
import { ModelAvatar } from '../components/ModelSwitcher';
import { FOLDER_LABELS } from '../folders';
import { Icon } from '../components/Icon';
import { Fold } from '../components/Sheet';

const COLORS = ['#4f46e5', '#db2777', '#059669', '#d97706', '#0891b2', '#7c3aed', '#dc2626', '#65a30d'];
const FOLDER_ORDER: FolderKind[] = ['references', 'photos', 'found', 'generated', 'edited'];
const DEFAULT_FOLDERS: FolderKind[] = ['found', 'generated', 'edited'];

function FolderRow({
  model,
  kind,
  onSaved,
  toast,
}: {
  model: Model;
  kind: FolderKind;
  onSaved: (m: Model) => void;
  toast: (m: string) => void;
}) {
  const path = model.folders[kind];
  const [busy, setBusy] = useState(false);
  async function save(next: string) {
    setBusy(true);
    try {
      onSaved(await api.updateModel(model.id, { folders: { [kind]: next } }));
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="folder-row">
      <div className="folder-main">
        <div className="folder-label">
          <strong className="small">{FOLDER_LABELS[kind]}</strong>
        </div>
        <div className={`small mono folder-path${path ? '' : ' muted'}`}>{path || 'Not connected'}</div>
      </div>
      <div className="row folder-actions">
        <button
          type="button"
          className="btn small"
          disabled={busy}
          onClick={async () => {
            try {
              const { path: chosen } = await api.pickFolder(path, `${FOLDER_LABELS[kind]} for ${model.name}`);
              if (chosen) await save(chosen);
            } catch (err) {
              toast((err as Error).message);
            }
          }}
        >
          {path ? 'Change…' : 'Connect folder…'}
        </button>
        {path && (
          <button type="button" className="btn link small" onClick={() => api.openFolder(path).catch((e) => toast(e.message))}>
            Open
          </button>
        )}
        {path && !DEFAULT_FOLDERS.includes(kind) && (
          <button type="button" className="btn link small" disabled={busy} onClick={() => save('')}>
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

// One provider's key for a model. A model can hold a key for every provider at once, so each has its
// own connect/remove here; you then switch between them freely in AI Studio. Keys are shown masked.
function ProviderKeyRow({
  model,
  provider,
  info,
  onSaved,
  toast,
}: {
  model: Model;
  provider: ProviderMeta;
  info: ProviderKeyInfo;
  onSaved: (next: ModelStudioKey) => void;
  toast: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [region, setRegion] = useState(info.region || provider.regions[0]?.id || 'intl');
  const [workspace, setWorkspace] = useState(info.hasKey ? info.workspace : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsWorkspace = provider.needsWorkspace;
  const multiRegion = provider.regions.length > 1;
  const regionOk = provider.regions.some((r) => r.id === region);
  const canSave = Boolean(key.trim() && regionOk && (!needsWorkspace || workspace.trim()));
  const regionName = provider.regions.find((r) => r.id === info.region)?.name ?? info.region;

  const chip = info.connected
    ? { cls: 'published', text: 'connected' }
    : info.hasKey
      ? { cls: 'draft', text: needsWorkspace ? 'needs workspace' : 'key saved' }
      : info.usingDefault
        ? { cls: '', text: 'shared default' }
        : null;
  const detail = info.hasKey
    ? `${multiRegion ? `${regionName} · ` : ''}${info.keyMasked}`
    : info.usingDefault
      ? 'using the shared default Wan key'
      : 'no key yet';

  async function run(fn: () => Promise<ModelStudioKey>, done: string) {
    setBusy(true);
    setError(null);
    try {
      onSaved(await fn());
      setKey('');
      setOpen(false);
      toast(done);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="folder-row" style={{ display: 'block' }}>
      <div className="row">
        <div className="small" style={{ flex: 1 }}>
          <strong>{provider.name}</strong> <span className="muted">· {provider.kind === 'image' ? 'images' : 'video'}</span>
          {chip && <span className={`chip ${chip.cls}`} style={{ marginLeft: 6 }}>{chip.text}</span>}
          <div className="muted small mono" style={{ marginTop: 2 }}>{detail}</div>
        </div>
        <button type="button" className="btn small" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : info.hasKey ? 'Change…' : 'Connect…'}
        </button>
      </div>
      {open && (
        <div className="stack" style={{ marginTop: 8 }}>
          <label className="field">
            <span className="small">
              API key {info.hasKey && <span className="muted small">(saved: {info.keyMasked})</span>}
            </span>
            <input
              type="password"
              autoComplete="off"
              placeholder={info.hasKey ? 'Paste a new key to replace it' : 'Paste the key for this account'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          {multiRegion && (
            <label className="field">
              <span className="small">Region</span>
              <select value={region} onChange={(e) => setRegion(e.target.value)}>
                {provider.regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {needsWorkspace && (
            <label className="field">
              <span className="small">
                Workspace ID <span className="muted small">(required)</span>
              </span>
              <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Model Studio workspace ID"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
              />
            </label>
          )}
          <p className="muted small" style={{ margin: 0 }}>
            {provider.keyHint}{' '}
            {provider.console && (
              <a href={provider.console} target="_blank" rel="noreferrer">
                Open the console
              </a>
            )}
          </p>
          {error && <div className="notice error small">{error}</div>}
          <div className="row">
            <button
              type="button"
              className="btn primary small"
              disabled={busy || !canSave}
              onClick={() =>
                run(
                  () => api.saveModelStudioKey(model.id, provider.id, key.trim() ? key : null, region, workspace.trim()),
                  `${provider.name} key saved for ${model.name}`
                )
              }
            >
              {busy ? 'Checking…' : 'Save key'}
            </button>
            {info.hasKey && (
              <button
                type="button"
                className="btn link small"
                disabled={busy}
                onClick={() => run(() => api.saveModelStudioKey(model.id, provider.id, '', region, ''), `${provider.name} key removed`)}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Every provider's key for one model, each connected independently. Connect the ones you want once;
// in AI Studio you switch between them without re-entering anything.
function ModelStudioKeySection({ model, toast }: { model: Model; toast: (m: string) => void }) {
  const [info, setInfo] = useState<ModelStudioKey | null>(null);
  useEffect(() => {
    let active = true;
    api
      .modelStudioKey(model.id)
      .then((i) => active && setInfo(i))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [model.id]);
  const connected = info ? info.providers.filter((p) => info.keys[p.id]?.connected).length : 0;
  return (
    <Fold title="AI Studio keys" summary={info ? (connected ? `${connected} connected` : 'None yet') : ''}>
      {info ? (
        info.providers.map((p) => {
          const ki = info.keys[p.id];
          return ki ? <ProviderKeyRow key={p.id} model={model} provider={p} info={ki} onSaved={setInfo} toast={toast} /> : null;
        })
      ) : (
        <p className="muted small">Loading…</p>
      )}
    </Fold>
  );
}

// A compact, read-only view of this model's posting accounts, plus a jump to the full Accounts page
// where you connect/move them. The posting engine itself is one shared connection (General settings).
function ModelPostingSection({ model, status, onManage }: { model: Model; status: AppStatus; onManage: () => void }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const engineOk = status.engine.state === 'ok';
  useEffect(() => {
    setAccounts(null);
    setError(null);
    if (!engineOk) return; // nothing to list until the shared posting engine is connected (General)
    let active = true;
    api
      .accounts(model.id)
      .then((a) => active && setAccounts(a))
      .catch((e) => active && setError((e as Error).message));
    return () => {
      active = false;
    };
  }, [model.id, engineOk]);
  return (
    <Fold
      title="Posting accounts"
      summary={!engineOk ? 'Engine not connected' : accounts ? (accounts.length ? `${accounts.length}` : 'None yet') : ''}
    >
      <div className="row">
        <button type="button" className="btn small" onClick={onManage}>
          <Icon name="users" size={14} />
          Manage accounts
        </button>
      </div>
      {!engineOk && (
        <div className="notice warn small" style={{ margin: 0 }}>
          Connect the posting engine in <strong>General</strong> to post and to add accounts.
        </div>
      )}
      {engineOk && error && <div className="notice error small" style={{ margin: 0 }}>{error}</div>}
      {engineOk && accounts === null && !error && <p className="muted small" style={{ margin: 0 }}>Loading accounts…</p>}
      {accounts && accounts.length === 0 && (
        <p className="muted small" style={{ margin: 0 }}>No accounts for {model.name} yet.</p>
      )}
      {accounts && accounts.length > 0 && (
        <div className="account-list">
          {accounts.map((a) => (
            <div className="account" key={a.id}>
              <AccountAvatar name={a.name} picture={a.picture} identifier={a.identifier} />
              <div className="account-main">
                <div className="account-name">{a.name}</div>
                <div className="account-meta facts">
                  <span>{a.platform}</span>
                  {a.profile && <span>@{a.profile}</span>}
                  {a.disabled && <span>Disabled</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Fold>
  );
}

// Everything for one model in one focused place: name & colour, its folders, its AI Studio key, and
// its posting accounts. Shown one model at a time (picked above) so the page never becomes a wall.
function ModelSettings({
  model,
  status,
  isCurrent,
  onSaved,
  onDelete,
  onSelect,
  onManageAccounts,
  toast,
}: {
  model: Model;
  status: AppStatus;
  isCurrent: boolean;
  onSaved: (m: Model) => void;
  onDelete: () => void;
  onSelect: () => void;
  onManageAccounts: () => void;
  toast: (m: string) => void;
}) {
  const [name, setName] = useState(model.name);
  const [typed, setTyped] = useState('');
  useEffect(() => setName(model.name), [model.name]);
  useEffect(() => setTyped(''), [model.id]);
  return (
    <section className="card settings-model">
      <div className="card-head">
        <h2 className="row" style={{ gap: 10, margin: 0, alignItems: 'center' }}>
          <ModelAvatar model={model} size={28} /> {model.name}
          {isCurrent && <span className="chip published">Showing now</span>}
        </h2>
        {!isCurrent && (
          <button type="button" className="btn small" onClick={onSelect}>
            Show {model.name}
          </button>
        )}
      </div>

      <Fold title="Folders" summary={`${FOLDER_ORDER.filter((k) => model.folders[k]).length} of ${FOLDER_ORDER.length} connected`} defaultOpen>
        {FOLDER_ORDER.map((kind) => (
          <FolderRow key={kind} model={model} kind={kind} onSaved={onSaved} toast={toast} />
        ))}
      </Fold>

      <ModelStudioKeySection model={model} toast={toast} />

      <ModelPostingSection model={model} status={status} onManage={onManageAccounts} />

      <Fold title="Name and colour" summary={model.name}>
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            onSaved(await api.updateModel(model.id, { name }));
            toast('Renamed');
          } catch (err) {
            toast((err as Error).message);
          }
        }}
      >
        <label className="field" style={{ flex: 1 }}>
          <span>Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn small" disabled={!name.trim() || name.trim() === model.name} style={{ alignSelf: 'flex-end' }}>
          Rename
        </button>
      </form>
      <div>
        <div className="field-label">Colour</div>
        <div className="row color-row">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-dot${model.color === c ? ' on' : ''}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
              aria-pressed={model.color === c}
              onClick={async () => onSaved(await api.updateModel(model.id, { color: c }))}
            />
          ))}
        </div>
      </div>
      </Fold>

      <Fold title="Remove model" className="danger-fold">
        <p className="small">Your files and folders stay where they are. Type {model.name} to confirm.</p>
        <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type the model's name" />
        <div className="row">
          <button type="button" className="btn danger small" disabled={typed.trim() !== model.name} onClick={onDelete}>
            Remove {model.name}
          </button>
        </div>
      </Fold>
    </section>
  );
}

function PostingDefaults({ prefs, save }: { prefs: Preferences; save: (patch: Partial<Preferences>) => void }) {
  return (
    <section className="card slim">
      <Fold title="Captions" summary={prefs.autoShorten ? 'Shortened to fit' : 'Left as written'}>
        <label className="check">
          <input type="checkbox" checked={prefs.autoShorten} onChange={(e) => save({ autoShorten: e.target.checked })} />
          <span>Shorten captions that are too long for a network</span>
        </label>
      </Fold>
      <Fold title="YouTube" summary={prefs.youtubeVisibility[0].toUpperCase() + prefs.youtubeVisibility.slice(1)}>
        <label className="field">
          <span>Video visibility</span>
          <select value={prefs.youtubeVisibility} onChange={(e) => save({ youtubeVisibility: e.target.value as Preferences['youtubeVisibility'] })}>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </label>
      </Fold>
      <Fold title="TikTok" summary={prefs.tiktokMode === 'UPLOAD' ? 'Drafts to the inbox' : 'Publish directly'}>
        <label className="field">
          <span>Who can watch</span>
          <select value={prefs.tiktokPrivacy} onChange={(e) => save({ tiktokPrivacy: e.target.value as Preferences['tiktokPrivacy'] })}>
            <option value="PUBLIC_TO_EVERYONE">Everyone</option>
            <option value="FOLLOWER_OF_CREATOR">Followers</option>
            <option value="MUTUAL_FOLLOW_FRIENDS">Friends</option>
            <option value="SELF_ONLY">Only me</option>
          </select>
        </label>
        <div className="notice warn small">
          Until TikTok approves your developer app (its "audit"), TikTok only accepts <strong>Only me</strong>, and the
          TikTok account itself must be set to private.
        </div>
        <label className="field">
          <span>How to post</span>
          <select value={prefs.tiktokMode} onChange={(e) => save({ tiktokMode: e.target.value as Preferences['tiktokMode'] })}>
            <option value="DIRECT_POST">Publish directly</option>
            <option value="UPLOAD">Send to the TikTok inbox as a draft (finish it in the app)</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={prefs.tiktokAllowComments} onChange={(e) => save({ tiktokAllowComments: e.target.checked })} />
          <span>Allow comments</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={prefs.tiktokAllowDuet} onChange={(e) => save({ tiktokAllowDuet: e.target.checked })} />
          <span>Allow Duets</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={prefs.tiktokAllowStitch} onChange={(e) => save({ tiktokAllowStitch: e.target.checked })} />
          <span>Allow Stitches</span>
        </label>
      </Fold>
      <Fold title="X (Twitter)">
        <label className="field">
          <span>Who can reply</span>
          <select value={prefs.xWhoCanReply} onChange={(e) => save({ xWhoCanReply: e.target.value as Preferences['xWhoCanReply'] })}>
            <option value="everyone">Everyone</option>
            <option value="following">Accounts you follow</option>
            <option value="mentionedUsers">Only accounts you mention</option>
            <option value="verified">Verified accounts</option>
          </select>
        </label>
      </Fold>
    </section>
  );
}


// Let other people reach this dashboard from their own computer, with a login.
function SharingCard({ status, onStatus, toast }: { status: AppStatus; onStatus: () => void; toast: (m: string) => void }) {
  const current = status.sharing ?? { enabled: false, host: '' };
  const [host, setHost] = useState(current.host);
  const [busy, setBusy] = useState(false);
  useEffect(() => setHost(current.host), [current.host]);

  async function save(enabled: boolean) {
    setBusy(true);
    try {
      await api.saveSharing(enabled, host.trim());
      onStatus();
      toast(enabled ? 'Sharing is on' : 'Sharing is off');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Fold title="Sharing" summary={current.enabled ? `On, ${current.host}` : 'Off'}>
      <label className="field">
        <span>Web address people will use</span>
        <input
          type="text"
          spellCheck={false}
          autoComplete="off"
          placeholder="ultimate.yourname.com"
          value={host}
          onChange={(e) => setHost(e.target.value)}
        />
      </label>
      <div className="row">
        {current.enabled ? (
          <>
            <button className="btn small" disabled={busy || !host.trim() || host.trim() === current.host} onClick={() => save(true)}>
              Save address
            </button>
            <button className="btn link small" disabled={busy} onClick={() => save(false)}>
              Turn sharing off
            </button>
          </>
        ) : (
          <button className="btn primary small" disabled={busy || !host.trim()} onClick={() => save(true)}>
            Turn sharing on
          </button>
        )}
      </div>
    </Fold>
  );
}

function randomPassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
  return out;
}

// One invited person: which models they can use, a password reset, and removal.
function PersonRow({ person, models, onChanged, toast }: { person: Person; models: Model[]; onChanged: () => void; toast: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(person.models);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setPicked(person.models), [person.models]);
  const changed = [...picked].sort().join() !== [...person.models].sort().join();

  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      onChanged();
      toast(done);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`model-card${open ? ' open' : ''}`}>
      <button type="button" className="model-card-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="account-main">
          <span className="account-name">{person.name || person.username}</span>
          <span className="account-meta facts">
            <span>@{person.username}</span>
            <span>{person.modelNames.length ? person.modelNames.join(', ') : 'No models yet'}</span>
          </span>
        </span>
        <span className="caret" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div className="stack model-card-body">
          <div>
            <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>
              Models they can use
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {models.map((m) => (
                <label key={m.id} className="check">
                  <input type="checkbox" checked={picked.includes(m.id)} onChange={() => toggle(m.id)} />
                  <span>{m.name}</span>
                </label>
              ))}
            </div>
            {changed && (
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn small" disabled={busy} onClick={() => run(() => api.setPersonModels(person.id, picked), 'Saved')}>
                  Save models
                </button>
              </div>
            )}
          </div>
          <label className="field">
            <span>Reset password</span>
            <div className="row">
              <input
                type="text"
                value={pw}
                autoComplete="off"
                placeholder="new password (6+ characters)"
                onChange={(e) => setPw(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn small" onClick={() => setPw(randomPassword())}>
                Generate
              </button>
              <button
                type="button"
                className="btn small"
                disabled={busy || pw.length < 6}
                onClick={() => run(async () => { await api.resetPersonPassword(person.id, pw); setPw(''); }, 'Password reset')}
              >
                Set
              </button>
            </div>
          </label>
          <div className="row">
            <span className="spacer" />
            <button
              type="button"
              className="btn danger small"
              disabled={busy}
              onClick={() => run(() => api.removePerson(person.id), `Removed ${person.username}`)}
            >
              Remove {person.username}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// The owner invites people here and chooses which models each one can use.
function PeopleCard({ models, toast }: { models: Model[]; toast: (m: string) => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.people().then(setPeople).catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <Fold title="People" summary={people ? (people.length ? `${people.length}` : 'Only you') : ''}>

      {people && people.length > 0 && (
        <div className="stack">
          {people.map((p) => (
            <PersonRow key={p.id} person={p} models={models} onChanged={load} toast={toast} />
          ))}
        </div>
      )}
      {people && people.length === 0 && (
        <p className="muted small" style={{ margin: 0 }}>
          No one invited yet.
        </p>
      )}

      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api.addPerson({ username: username.trim(), password, name: name.trim(), models: picked });
            setName('');
            setUsername('');
            setPassword('');
            setPicked([]);
            load();
            toast(`Added ${username.trim()}`);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="small" style={{ fontWeight: 600 }}>
          Invite someone
        </div>
        <div className="row2">
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ben" />
          </label>
          <label className="field">
            <span>Username</span>
            <input value={username} autoComplete="off" onChange={(e) => setUsername(e.target.value)} placeholder="ben" />
          </label>
        </div>
        <label className="field">
          <span>Password</span>
          <div className="row">
            <input
              type="text"
              value={password}
              autoComplete="off"
              placeholder="at least 6 characters"
              onChange={(e) => setPassword(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn small" onClick={() => setPassword(randomPassword())}>
              Generate
            </button>
          </div>
        </label>
        <div>
          <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>
            Models they can use
          </div>
          {models.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>
              Add a model first.
            </p>
          ) : (
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {models.map((m) => (
                <label key={m.id} className="check">
                  <input type="checkbox" checked={picked.includes(m.id)} onChange={() => toggle(m.id)} />
                  <span>{m.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {error && <div className="notice error small">{error}</div>}
        <div className="row">
          <button className="btn primary small" disabled={busy || !username.trim() || password.length < 6}>
            Add person
          </button>
        </div>
      </form>
    </Fold>
  );
}

// The shared, owner-only settings that aren't about one model: the posting engine, the default AI
// Studio key, posting defaults, sharing and the people invited.
function GeneralSettings({
  status,
  models,
  prefs,
  onStatus,
  reload,
  savePrefs,
  toast,
}: {
  status: AppStatus;
  models: Model[];
  prefs: Preferences | null;
  onStatus: () => void;
  reload: () => void;
  savePrefs: (patch: Partial<Preferences>) => void;
  toast: (m: string) => void;
}) {
  return (
    <>
      <EngineSetup status={status} onDone={() => { onStatus(); reload(); }} toast={toast} compact />
      {status.engine.configured && (
        <div className="row" style={{ margin: '-8px 0 16px' }}>
          <button
            type="button"
            className="btn link small"
            onClick={async () => {
              await api.disconnectEngine();
              onStatus();
              toast('Posting engine disconnected');
            }}
          >
            Disconnect the posting engine
          </button>
        </div>
      )}

      {prefs && (
        <>
          <h2 className="group-title">Posting defaults</h2>
          <PostingDefaults prefs={prefs} save={savePrefs} />
        </>
      )}

      <h2 className="group-title">AI Studio</h2>
      <section className="card slim">
        <FaceFusionCard toast={toast} />
      </section>

      <h2 className="group-title">Sharing</h2>
      <section className="card slim">
        <SharingCard status={status} onStatus={onStatus} toast={toast} />
        <PeopleCard models={models} toast={toast} />
      </section>

      <footer className="about">
        <span>
          {status.brand} {status.version}
        </span>
        <span className="mono">build {status.build}</span>
        {status.updateAvailable && <span className="chip posting">Update ready, reopen the app</span>}
      </footer>
    </>
  );
}

// FaceFusion (AI Studio's local "Face swap"): one install on this Mac, shared by every model, no key.
function FaceFusionCard({ toast }: { toast: (m: string) => void }) {
  const [path, setPath] = useState('');
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .settings()
      .then((s) => {
        setPath(s.faceFusionPath || '');
        setReady(!!s.faceFusionReady);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setBusy(true);
    try {
      const s = await api.saveFaceFusion(path.trim());
      setReady(!!s.faceFusionReady);
      toast(
        s.faceFusionReady ? 'FaceFusion found ✓' : path.trim() ? "Saved — but that command wasn't found" : 'Cleared'
      );
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Fold title="FaceFusion face swap" summary={loaded ? (ready ? 'Found' : 'Not set up') : ''}>
      <label className="field">
        <span className="small">FaceFusion command</span>
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/path/to/python /path/to/facefusion.py"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <button className="btn primary small" onClick={save} disabled={busy || !loaded}>
          Save
        </button>
        {loaded && <span className={ready ? 'chip published' : 'chip'}>{ready ? 'Found' : 'Not found yet'}</span>}
      </div>
    </Fold>
  );
}

export function SettingsPage({
  status,
  models,
  current,
  toast,
  onStatus,
  onModels,
  onSelectModel,
  onCreateModel,
  onGoAccounts,
}: {
  status: AppStatus;
  models: Model[];
  current: Model;
  toast: (m: string) => void;
  onStatus: () => void;
  onModels: (list: Model[]) => void;
  onSelectModel: (id: string) => void;
  onCreateModel: (name: string) => Promise<void>;
  onGoAccounts?: () => void;
}) {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  // Which panel is showing: a model's id, or 'general' for the shared owner settings.
  const [view, setView] = useState<string>(current.id);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (status.engine.state === 'ok') api.preferences().then(setPrefs).catch(() => {});
  }, [status.engine.state]);

  useEffect(load, [load]);

  async function savePrefs(patch: Partial<Preferences>) {
    setPrefs((p) => (p ? { ...p, ...patch } : p));
    try {
      setPrefs(await api.savePreferences(patch));
      toast('Saved');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const replaceModel = (mo: Model) => onModels(models.map((x) => (x.id === mo.id ? mo : x)));
  const selected = view === 'general' ? null : models.find((mm) => mm.id === view) ?? null;

  return (
    <div>
      <header className="page-head">
        <h1>Settings</h1>
      </header>
      {error && <div className="notice error">{error}</div>}

      <div className="settings-picker">
        <div className="segmented" role="tablist" aria-label="Settings for">
          {models.map((mo) => (
            <button key={mo.id} type="button" role="tab" aria-selected={view === mo.id} className={view === mo.id ? 'on' : ''} onClick={() => setView(mo.id)}>
              <ModelAvatar model={mo} size={18} /> {mo.name}
            </button>
          ))}
          <button type="button" role="tab" aria-selected={view === 'general'} className={view === 'general' ? 'on' : ''} onClick={() => setView('general')}>
            <Icon name="sliders" size={14} /> General
          </button>
        </div>
        {adding ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await onCreateModel(newName);
                setNewName('');
                setAdding(false);
              } catch (err) {
                toast((err as Error).message);
              }
            }}
            style={{ display: 'inline-flex', gap: 6 }}
          >
            <input
              autoFocus
              type="text"
              placeholder="New model's name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="New model's name"
            />
            <button className="btn small" disabled={!newName.trim()}>
              Add
            </button>
            <button type="button" className="btn link small" onClick={() => { setAdding(false); setNewName(''); }}>
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" className="btn small" onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} />
            Add model
          </button>
        )}
      </div>

      {selected ? (
        <ModelSettings
          key={selected.id}
          model={selected}
          status={status}
          isCurrent={selected.id === current.id}
          onSaved={replaceModel}
          onSelect={() => onSelectModel(selected.id)}
          onManageAccounts={() => {
            onSelectModel(selected.id);
            onGoAccounts?.();
          }}
          toast={toast}
          onDelete={async () => {
            try {
              await api.deleteModel(selected.id);
              const remaining = models.filter((x) => x.id !== selected.id);
              onModels(remaining);
              setView(remaining[0]?.id ?? 'general');
              toast(`Removed ${selected.name}`);
            } catch (err) {
              toast((err as Error).message);
            }
          }}
        />
      ) : (
        <GeneralSettings
          status={status}
          models={models}
          prefs={prefs}
          onStatus={onStatus}
          reload={load}
          savePrefs={savePrefs}
          toast={toast}
        />
      )}
    </div>
  );
}
