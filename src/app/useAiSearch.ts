/**
 * AI 検索（ADR 0033）の状態と実行。検索語をタグに読み替えるだけで、結果の並べ方は core/logic/semanticSearch.ts。
 *
 * - 既定は切。利用者が「AI で意味の近い動画も探す」を入れたときだけモデルを読む（初回に約 240 MB）
 * - 入れたかどうかは端末に覚える（保存領域が使えなくても動く）
 * - タグの説明文の埋め込みは、モデルごとに 1 回だけ作ってメモリに置く
 */

import { useCallback, useRef, useState } from 'react';
import { pickTags, rankTags, type TagScore } from '@/core/logic/semanticSearch';
import type { TagField } from '@/core/constants/tags';
import { useServices } from '@/shared/hooks/useServices';

const STORAGE_KEY = 'loca.aiSearch';

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export interface AiSearch {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  /** 初回に読み込む大きさの目安（MB） */
  sizeMb: number;
  /** 読み込み中の進み具合（0〜1）。読み込んでいないときは undefined、分からないときは null */
  progress: number | null | undefined;
  /** 検索語をタグに読み替える。切のとき・読み替えないときは空。失敗は UpstreamError */
  tagsFor: (query: string) => Promise<TagScore[]>;
}

export function useAiSearch(): AiSearch {
  const { semantic, semanticModel } = useServices();
  const [enabled, setEnabledState] = useState(readEnabled);
  const [progress, setProgress] = useState<number | null | undefined>(undefined);
  const tagVectors = useRef<{ model: string; tags: { key: string; field: TagField; vector: number[] }[] } | null>(null);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    try {
      localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch {
      // 覚えられなくても、この訪問の間は効く
    }
  }, []);

  const tagsFor = useCallback(
    async (query: string): Promise<TagScore[]> => {
      if (!enabled || !query.trim()) return [];
      const port = await semantic();
      setProgress(null);
      try {
        await port.load(setProgress);
        if (tagVectors.current?.model !== port.model.id) {
          // 説明文は AI 検索を使うときだけ読む（初期読み込みの JS を 260 kB 以内に保つ）
          const { TAG_DESCRIPTIONS, tagDocument } = await import('@/core/constants/tagDescriptions');
          const keys = Object.keys(TAG_DESCRIPTIONS);
          const vectors = await port.embedDocuments(keys.map(tagDocument));
          tagVectors.current = {
            model: port.model.id,
            tags: keys.map((key, i) => ({ key, field: TAG_DESCRIPTIONS[key].field, vector: vectors[i] })),
          };
        }
        const ranked = rankTags(await port.embedQuery(query.trim()), tagVectors.current.tags);
        return pickTags(ranked, port.model.rule);
      } finally {
        setProgress(undefined);
      }
    },
    [enabled, semantic],
  );

  return { enabled, setEnabled, sizeMb: semanticModel.sizeMb, progress, tagsFor };
}
