import { useState } from 'react';
import type { LibraryItem, Model } from '../types';
import { api } from '../api';
import { formatBytes } from '../format';
import { Icon } from './Icon';

function Thumb({ model, item }: { model: Model; item: LibraryItem }) {
  // Prefer the small generated thumbnail. If it fails (e.g. ffmpeg unavailable), fall back to the
  // full image for pictures so they still show; videos can't render as <img>, so they get a glyph.
  const [stage, setStage] = useState<'thumb' | 'file' | 'glyph'>('thumb');
  const isImage = item.kind === 'image';
  const src =
    stage === 'thumb' ? api.libraryThumb(model.id, item.path) : stage === 'file' ? api.libraryFile(model.id, item.path) : '';
  const onError = () => setStage((s) => (s === 'thumb' && isImage ? 'file' : 'glyph'));
  return (
    <span className="lib-thumb">
      {stage !== 'glyph' ? (
        <img src={src} alt="" loading="lazy" onError={onError} />
      ) : (
        <span className="lib-thumb-fallback"><Icon name={item.kind === 'video' ? 'video' : 'image'} size={22} /></span>
      )}
      {item.kind === 'video' && <span className="lib-play" aria-hidden="true"><Icon name="play" size={12} /></span>}
    </span>
  );
}

export function LibraryGrid({
  model,
  items,
  renderActions,
  onPick,
  selected,
}: {
  model: Model;
  items: LibraryItem[];
  renderActions?: (item: LibraryItem) => React.ReactNode;
  onPick?: (item: LibraryItem) => void;
  // Picking several (a carousel): the chosen paths, in the order they were chosen.
  selected?: string[];
}) {
  return (
    <div className="lib-grid">
      {items.map((item) =>
        onPick ? (
          <button
            key={item.path}
            type="button"
            className={`lib-item pickable${selected?.includes(item.path) ? ' picked' : ''}`}
            onClick={() => onPick(item)}
            title={item.path}
            aria-pressed={selected ? selected.includes(item.path) : undefined}
          >
            <Thumb model={model} item={item} />
            {selected?.includes(item.path) && <span className="pick-order">{selected.indexOf(item.path) + 1}</span>}
            <span className="lib-name">{item.name}</span>
            <span className="lib-meta facts">
              {item.folder && <span>{item.folder}</span>}
              <span>{formatBytes(item.size)}</span>
            </span>
          </button>
        ) : (
          <div key={item.path} className="lib-item" title={item.path}>
            <a href={api.libraryFile(model.id, item.path)} target="_blank" rel="noreferrer" className="lib-open">
              <Thumb model={model} item={item} />
            </a>
            <span className="lib-name">{item.name}</span>
            <span className="lib-meta facts">
              <span>{formatBytes(item.size)}</span>
              <span>{new Date(item.modified * 1000).toLocaleDateString()}</span>
            </span>
            {renderActions && <div className="lib-actions">{renderActions(item)}</div>}
          </div>
        )
      )}
    </div>
  );
}
