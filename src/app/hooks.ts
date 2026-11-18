import { useEffect, useRef, useState } from 'react';
import { data } from '../data';

/**
 * Load data asynchronously and reload automatically whenever anything in the
 * database changes. Returns `undefined` while loading.
 *
 *   const tags = useData(() => data.tags.list(), []);
 */
export function useData<T>(loader: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let alive = true;
    const run = () => {
      loaderRef.current().then(
        (v) => alive && setValue(() => v),
        (e) => console.error(e),
      );
    };
    run();
    const off = data.onChange(run);
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}

/** Media query hook, e.g. useMedia('(min-width: 900px)') */
export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** Object URL for a stored file (photo/PDF); revoked automatically. */
export function useFileUrl(fileId: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!fileId) {
      setUrl(null);
      return;
    }
    let u: string | null = null;
    let alive = true;
    data.files.get(fileId).then((f) => {
      if (!alive || !f) return;
      u = URL.createObjectURL(f.blob);
      setUrl(u);
    });
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [fileId]);
  return url;
}

/** Browser tab / window title: "<page> · ConnecTag". */
export function useTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} · ConnecTag` : 'ConnecTag';
  }, [title]);
}
