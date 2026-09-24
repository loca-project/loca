/**
 * Actions のジョブ概要（scripts/lib/summary.mjs。T31）。一時ファイルに書いて確かめる。
 * 実行: npm run test:scripts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeSummary } from '../../scripts/lib/summary.mjs';

describe('writeSummary', () => {
  it('見出しと表を追記する（| と改行は表を壊さない形にする）', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'loca-summary-'));
    const file = path.join(dir, 'summary.md');
    try {
      writeSummary('同期', [['markers.json', '1 件 → 2 件'], ['a|b', 'x\ny']], file);
      writeSummary('削除', [['マーカー', 0]], file);
      assert.equal(
        readFileSync(file, 'utf8'),
        '### 同期\n\n| 項目 | 値 |\n|---|---|\n| markers.json | 1 件 → 2 件 |\n| a\\|b | x y |\n\n' +
          '### 削除\n\n| 項目 | 値 |\n|---|---|\n| マーカー | 0 |\n\n',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('書き先が無ければ（Actions の外）何もしない', () => {
    assert.equal(writeSummary('同期', [['a', 1]], ''), '');
  });
});
