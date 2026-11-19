// Two fixed columns without a row grid: tiles stack directly below each other.
// Every tile belongs to one column for good – hiding a tile (node = null/false) only moves
// the tiles of the same column up. Narrow screens: one column in `order`.
import type { ReactNode } from 'react';
import { useMedia } from '../app/hooks';

export interface Tile {
  key: string;
  col: 'left' | 'right';
  node: ReactNode;
  /** position in the single-column (phone) layout; default: left tiles, then right tiles */
  order?: number;
  /** stretch this tile to the bottom of the taller column */
  grow?: boolean;
}

export function Columns({
  tiles,
  breakpoint = 1100,
  left = '1fr',
  right = '1fr',
}: {
  tiles: Tile[];
  breakpoint?: number;
  left?: string;
  right?: string;
}) {
  const wide = useMedia(`(min-width: ${breakpoint}px)`);
  const visible = tiles.filter((t) => t.node);
  if (!wide) {
    const idx = (t: Tile) => t.order ?? (t.col === 'left' ? 0 : 1000) + tiles.indexOf(t);
    return (
      <div className="cols-one">
        {[...visible]
          .sort((a, b) => idx(a) - idx(b))
          .map((t) => (
            <div key={t.key} className="col-tile">
              {t.node}
            </div>
          ))}
      </div>
    );
  }
  const col = (c: 'left' | 'right') => (
    <div className="col">
      {visible
        .filter((t) => t.col === c)
        .map((t) => (
          <div key={t.key} className={`col-tile${t.grow ? ' grow' : ''}`}>
            {t.node}
          </div>
        ))}
    </div>
  );
  return (
    <div className="cols-two" style={{ gridTemplateColumns: `minmax(0, ${left}) minmax(0, ${right})` }}>
      {col('left')}
      {col('right')}
    </div>
  );
}
