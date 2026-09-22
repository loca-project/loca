/**
 * GitHub Issue フォームへの投稿導線。
 *
 * Loca はデータベースも認証サーバーも持たない。書き込みはすべて
 * 「GitHub Issue を開く → Actions が検証して JSON に追記 → Pages に反映」で行う。
 * 本人確認は GitHub アカウントが兼ねる。
 *
 * Issue フォーム（.github/ISSUE_TEMPLATE/*.yml）の各 `id` は、
 * クエリ文字列で初期値を渡せる。ここではその URL を組み立てるだけ。
 */

import { appConfig, canContribute } from '@/runtime/config';

export type IssueKind = 'marker' | 'request' | 'report';

function templateOf(kind: IssueKind): string {
  const { markerTemplate, requestTemplate, reportTemplate } = appConfig.github;
  if (kind === 'marker') return markerTemplate;
  if (kind === 'request') return requestTemplate;
  return reportTemplate;
}

/** Issue のタイトル。GitHub の仕様で必須なので、利用者に書かせずここで組み立てる。 */
const TITLE_MAX = 80;

function buildTitle(kind: IssueKind, summary?: string): string {
  const prefix = kind === 'marker' ? '[marker]' : kind === 'request' ? '[request]' : '[report]';
  const body = (summary ?? '').replace(/\s+/g, ' ').trim();
  if (!body) return `${prefix} ${kind === 'marker' ? '新しいマーカー' : kind === 'request' ? '撮影リクエスト' : 'マーカーの通報'}`;
  const room = TITLE_MAX - prefix.length - 1;
  return `${prefix} ${body.length > room ? `${body.slice(0, room - 1)}…` : body}`;
}

/**
 * 値が空のフィールドは送らない（Issue フォーム側の必須チェックに任せる）。
 *
 * 注意: GitHub の Issue フォームは **input と textarea しか事前入力できない**。
 * dropdown と checkboxes はクエリパラメータを無視する。
 * そのため、事前入力したい項目はテンプレート側で input にしてある。
 *
 * @param summary タイトルに載せる短い説明（地名や動画タイトル）
 */
export function buildIssueUrl(
  kind: IssueKind,
  fields: Record<string, string | undefined>,
  summary?: string,
): string | null {
  if (!canContribute()) return null;

  const params = new URLSearchParams();
  params.set('template', templateOf(kind));
  params.set('labels', `loca:${kind}`);
  params.set('title', buildTitle(kind, summary));

  for (const [key, value] of Object.entries(fields)) {
    if (value != null && value !== '') params.set(key, value);
  }

  return `https://github.com/${appConfig.github.repo}/issues/new?${params.toString()}`;
}

/** 新しいタブで Issue フォームを開く。開けなければ false。 */
export function openIssueForm(
  kind: IssueKind,
  fields: Record<string, string | undefined>,
  summary?: string,
): boolean {
  const url = buildIssueUrl(kind, fields, summary);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/** 投稿済みの Issue 一覧（利用者が自分の投稿状況を追えるように）。 */
export function issueListUrl(kind?: IssueKind): string | null {
  if (!canContribute()) return null;
  const label = kind ? `+label%3A%22loca%3A${kind}%22` : '';
  return `https://github.com/${appConfig.github.repo}/issues?q=is%3Aissue${label}`;
}
