import type { VideoMeta } from '@/core/types';
import type { Adapter } from './common';

/**
 * 動画メタデータ取得ポート。
 * Google API を使わない構成のため、取得できるのは
 * タイトル / チャンネル名 / サムネイル の 3 項目のみ。
 */
export interface VideoMetaPort extends Adapter {
  /** 取得できなければ UpstreamError を投げる。 */
  fetchMeta(videoId: string): Promise<VideoMeta>;
}
