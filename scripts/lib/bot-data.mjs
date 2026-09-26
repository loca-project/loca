/**
 * push の前に、origin にだけあるコミットを取り込んでよいかを決める（npm run deploy。2026-09-26 T32）。
 * 手動で同期を流した直後は、Actions のボットが公開データのコミットを先に main へ入れていて、push が non-fast-forward で拒否される。
 * 取り込むのは「ボットが公開データのファイルだけを書き換えた」ときだけ。ほかが混ざっていたら止める（CP-4）。
 */

/** ワークフロー（sync-firestore.yml・sync-equipment.yml）の git config と同じ。作者とコミッターの両方で照合する */
export const BOT = 'github-actions[bot]';
export const BOT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com';
/** ワークフローが git add するファイル */
export const BOT_FILES = ['public/data/markers.json', 'public/data/requests.json', 'public/data/equipment.json'];

/**
 * @param {{ identities: string[], files: string[], dirty: string[], staged: string[] }} input
 *   identities: origin にだけあるコミットの `作者名|作者メール|コミッター名|コミッターメール`、files: それらが変えたファイル、
 *   dirty: 手元の未コミットのファイル、staged: そのうちステージ済みのファイル
 * @returns {{ action: 'none' | 'rebase' | 'merge' | 'stop', reason: string }}
 */
export function botDataPlan({ identities, files, dirty, staged }) {
  if (identities.length === 0) return { action: 'none', reason: '取り込むコミットは無い' };
  const bot = [BOT, BOT_EMAIL, BOT, BOT_EMAIL].join('|');
  const others = [...new Set(identities.filter((id) => id !== bot).map((id) => id.split('|')[0]))];
  if (others.length > 0) return { action: 'stop', reason: `ボット以外のコミットがある（${others.join(', ')}）` };
  const outside = files.filter((f) => !BOT_FILES.includes(f));
  if (outside.length > 0) return { action: 'stop', reason: `公開データ以外の変更がある（${outside.join(', ')}）` };
  const overlap = dirty.filter((f) => files.includes(f));
  if (overlap.length > 0) return { action: 'stop', reason: `取り込む公開データに未コミットの変更がある（${overlap.join(', ')}。git checkout -- で戻す）` };
  // ステージ済みの変更（別のチャットのもの）があると、早送りでない merge は始まる前に拒否される
  if (staged.length > 0) return { action: 'stop', reason: `ステージ済みの変更がある（${staged.length} 件。コミットされてから再実行）` };
  const n = identities.length;
  // 別のチャットの書きかけがあると rebase は動かない。merge なら作業ツリーの書きかけに触れずに済む
  return dirty.length === 0
    ? { action: 'rebase', reason: `Actions の公開データのコミット ${n} 件を rebase で取り込む` }
    : { action: 'merge', reason: `Actions の公開データのコミット ${n} 件を merge で取り込む（未コミットの変更 ${dirty.length} 件に触れない）` };
}
