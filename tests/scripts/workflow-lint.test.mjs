/**
 * ワークフローの決まりの検査（scripts/lib/workflow-lint.mjs）。通信しない。
 * 実行: npm run test:scripts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lintWorkflows } from '../../scripts/lib/workflow-lint.mjs';

const good = `name: 同期（Firestore → 公開データ）
on:
  schedule:
    - cron: '0 15 * * *'
    - cron: '15 0-14,16-23 * * *'
jobs:
  refresh:
    if: \${{ github.event.schedule == '15 0-14,16-23 * * *' }}
    runs-on: ubuntu-26.04
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
      - uses: google-github-actions/auth@v3
`;

describe('lintWorkflows', () => {
  it('決まりどおりなら問題なし', () => {
    assert.deepEqual(lintWorkflows([{ file: 'sync.yml', text: good }]), []);
  });

  it('英語の名前・ubuntu-latest・古い Actions・存在しない cron を拾う', () => {
    const bad = good
      .replace('name: 同期（Firestore → 公開データ）', 'name: Sync')
      .replace('ubuntu-26.04', 'ubuntu-latest')
      .replace('actions/checkout@v7', 'actions/checkout@v4')
      .replace("- cron: '15 0-14,16-23 * * *'", "- cron: '30 * * * *'");
    assert.deepEqual(lintWorkflows([{ file: 'sync.yml', text: bad }]), [
      'sync.yml: name が日本語でない（name: Sync）',
      'sync.yml: runs-on が版の固定でない（ubuntu-latest）',
      'sync.yml: actions/checkout@v4 は古い（v5 以上。Node.js 20 は非推奨）',
      "sync.yml: 比べている cron '15 0-14,16-23 * * *' が on.schedule に無い",
    ]);
  });

  it('タブ文字と name の欠落を拾う', () => {
    const problems = lintWorkflows([{ file: 'x.yml', text: 'on:\n\tpush:\n' }]);
    assert.deepEqual(problems, ['x.yml: タブ文字がある（YAML ではインデントに使えない）', 'x.yml: トップレベルの name が無い']);
  });
});
