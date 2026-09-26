/**
 * 検索とランキングの実行。結果は共通結果パネル用の行に正規化して返す。
 * 検索（件数制限なし）とランキング（上限あり）はロジックを分けている（要件 1.2）。
 */

import { useCallback, useState } from 'react';
import type { Bounds, MarkerData, RankingFilter, RequestMarkerData } from '@/core/types';
import { RANKING_BASE_LIMIT, TabMode } from '@/core/types';
import { isLimitedByFilter, rankEquipment, rankPrefectures } from '@/core/logic/ranking';
import { searchMarkersByBounds } from '@/core/logic/search';
import { searchMarkersWithTags, type TagScore } from '@/core/logic/semanticSearch';
import { tagLabel } from '@/core/constants/tags';
import { rankRequestSpots } from '@/core/logic/requests';
import { boundsOf } from '@/core/logic/geo';
import { formatCount, interpolate } from '@/core/logic/format';
import { rankPeople, type PeopleFilter } from '@/core/logic/people';
import { useServices } from '@/shared/hooks/useServices';
import { useI18n } from '@/shared/hooks/useI18n';
import {
  rowsFromGroups,
  rowsFromMarkers,
  rowsFromRequestMarkers,
  type ResultRow,
} from '@/features/results/resultRow';

export interface ResultsState {
  open: boolean;
  title: string;
  rows: ResultRow[];
  limitedTo?: number;
}

const CLOSED: ResultsState = { open: false, title: '', rows: [] };

export function useSearchAndRanking() {
  const { map, geocode } = useServices();
  const { t, lang } = useI18n();
  const [results, setResults] = useState<ResultsState>(CLOSED);
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => setResults(CLOSED), []);

  /** 地図検索: 地名を座標に変換して地図を動かす。 */
  const searchPlace = useCallback(
    async (query: string): Promise<string | null> => {
      if (!query.trim()) return null;
      setLoading(true);
      try {
        const pos = await geocode.forward(query.trim());
        map.setCenter(pos, 12);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      } finally {
        setLoading(false);
      }
    },
    [geocode, map],
  );

  /**
   * マーカー検索: 語の一致で絞り込む。件数制限は設けない。
   * AI 検索で読み替えたタグ（ADR 0033）があれば、そのタグを持つ動画を後ろに足し、題に読み替えを出す。
   */
  const searchMarkers = useCallback(
    (query: string, markers: MarkerData[], aiTags: TagScore[] = []) => {
      const hits = searchMarkersWithTags(markers, query, aiTags);
      const labels = aiTags.map((tag) => tagLabel(tag.key, lang === 'en' ? 'en' : 'ja')).join('・');
      const title = labels ? `${t.headers.searchResults}（${interpolate(t.form.aiReadAs, { tags: labels })}）` : t.headers.searchResults;
      setResults({ open: true, title, rows: rowsFromMarkers(hits) });

      const bounds = boundsOf(hits.map((m) => ({ lat: m.lat, lng: m.lng })));
      if (bounds) map.fitBounds(bounds, 80);
    },
    [map, t, lang],
  );

  /** 範囲指定検索（要件 3.1.3）。矩形の内側だけを、件数制限なしで返す。 */
  const searchInBounds = useCallback(
    (bounds: Bounds, markers: MarkerData[]) => {
      const hits = searchMarkersByBounds(markers, bounds);
      setResults({ open: true, title: t.headers.searchResults, rows: rowsFromMarkers(hits) });
    },
    [t],
  );

  const applyRanking = useCallback(
    (
      tab: TabMode,
      filter: RankingFilter,
      markers: MarkerData[],
      requestMarkers: RequestMarkerData[],
    ) => {
      const limited = isLimitedByFilter(filter) ? RANKING_BASE_LIMIT : undefined;

      if (tab === TabMode.RANKING_EQUIPMENT) {
        setResults({
          open: true,
          title: t.headers.gearRanking,
          rows: rowsFromGroups(rankEquipment(markers, filter)),
          limitedTo: limited,
        });
        return;
      }

      if (tab === TabMode.RANKING_REQUEST) {
        setResults({
          open: true,
          title: t.headers.requestRanking,
          rows: rowsFromRequestMarkers(rankRequestSpots(requestMarkers, filter.tags, filter.limit)),
        });
        return;
      }

      setResults({
        open: true,
        title: t.headers.regionRanking,
        rows: rowsFromGroups(rankPrefectures(markers, filter)),
        limitedTo: limited,
      });
    },
    [t],
  );

  /** ユーザーのタブの検索（T93・ADR 0031）。条件に合う動画だけで投稿者ごとに数え、ソート順に並べる。 */
  const searchPeople = useCallback(
    (filter: PeopleFilter, markers: MarkerData[]) => {
      const pt = t.people;
      const rows: ResultRow[] = rankPeople(markers, filter).map((p) => ({
        id: p.uid,
        title: p.name,
        subtitle: interpolate(pt.stats, {
          posts: formatCount(p.posts),
          views: formatCount(p.views),
          likes: formatCount(p.likes),
          requests: formatCount(p.requests),
        }),
        metric: '',
        poster: { uid: p.uid, name: p.name },
      }));
      setResults({ open: true, title: `${pt.results}（${pt.orders[filter.order]}）`, rows });
    },
    [t],
  );

  return { results, loading, close, searchPlace, searchMarkers, searchInBounds, applyRanking, searchPeople };
}
