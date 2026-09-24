/**
 * 同じ処理を同時に 2 回走らせない（ボタンの連打・ダブルクリック対策）。
 *
 * ボタンの disabled は再描画を待つので、その前の 2 回目の押下は止められない。
 * ここでは ref で即座に判定し、実行中の 2 回目は何もせず undefined を返す（エラーも出さない）。
 */

import { useCallback, useRef, useState } from 'react';

export function useExclusive() {
  const running = useRef(false);
  const [loading, setLoading] = useState(false);

  const exclusive = useCallback(async <T,>(task: () => Promise<T>): Promise<T | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    setLoading(true);
    try {
      return await task();
    } finally {
      running.current = false;
      setLoading(false);
    }
  }, []);

  return { loading, exclusive };
}
