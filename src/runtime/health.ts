/** データの鮮度と読み込み状態を 1 箇所に集約し、UI から見えるようにする。 */

export interface RuntimeHealth {
  /** 公開データが生成された時刻（epoch ms）。0 なら不明 */
  generatedAt: number;
  /** 公開データを 1 件も読めなかったか */
  dataUnavailable: boolean;
  /** 地図スタイルの読み込みに失敗して代替に切り替えたか */
  mapFallback: boolean;
  /** 利用者に見せたい注意書き */
  notice?: string;
}

type Listener = (health: RuntimeHealth) => void;

const state: RuntimeHealth = {
  generatedAt: 0,
  dataUnavailable: false,
  mapFallback: false,
};

const listeners = new Set<Listener>();

export function getHealth(): RuntimeHealth {
  return { ...state };
}

export function setHealth(patch: Partial<RuntimeHealth>): void {
  Object.assign(state, patch);
  const snapshot = getHealth();
  listeners.forEach((l) => l(snapshot));
}

export function subscribeHealth(cb: Listener): () => void {
  listeners.add(cb);
  cb(getHealth());
  return () => listeners.delete(cb);
}
