import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadTextFile } from '@/shared/lib/download';

describe('downloadTextFile', () => {
  afterEach(() => vi.restoreAllMocks());

  it('saves the text under the given name, then lets go of the object URL', async () => {
    let blob: Blob | undefined;
    const create = vi.fn((value: Blob) => {
      blob = value;
      return 'blob:fake';
    });
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const clicked: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clicked.push({ href: this.href, download: this.download });
    });

    downloadTextFile('export.csv', 'a,b', 'text/csv');

    expect(clicked).toEqual([{ href: 'blob:fake', download: 'export.csv' }]);
    expect(blob?.type).toBe('text/csv;charset=utf-8');
    const bytes = new Uint8Array((await blob?.arrayBuffer()) ?? new ArrayBuffer(0));
    expect([...bytes]).toEqual([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('a,b')]);
    expect(revoke).toHaveBeenCalledWith('blob:fake');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
