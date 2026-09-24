/**
 * GitHub Issue を公開データ（markers.json / requests.json）に取り込む。
 *
 * GitHub Actions から呼ばれる。データベースの代わりを務める唯一の書き込み経路。
 *
 * 環境変数:
 *   LOCA_ISSUE_KIND    marker | request
 *   LOCA_ISSUE_NUMBER  Issue 番号
 *   LOCA_ISSUE_AUTHOR  投稿者の GitHub アカウント名
 *   LOCA_ISSUE_BODY    Issue の本文
 *
 * 検証に落ちたら非ゼロで終了する。呼び出し側がその理由を Issue にコメントする。
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getYoutubeId, parseIssueForm, toNumber } from './lib/issue-body.mjs';
import { fetchPlace, fetchVideoMeta } from './lib/enrich.mjs';
import { MARKER_LABELS, REQUEST_LABELS, validateMarker, validateRequest } from './lib/validate.mjs';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const MARKERS = path.join(DATA_DIR, 'markers.json');
const REQUESTS = path.join(DATA_DIR, 'requests.json');
/** 同一地点とみなす距離（度）。約 30m 相当。 */
const SAME_SPOT_EPS = 0.0003;

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

async function readBundle(file, key = 'markers') {
  try {
    const raw = JSON.parse(await readFile(file, 'utf8'));
    if (Array.isArray(raw)) return { generatedAt: 0, [key]: raw };
    // syncedAt（Firestore と同期した時刻）は引き継ぐ。ここで進めると Firestore の変更を取りこぼす
    const synced = raw.syncedAt ? { syncedAt: raw.syncedAt } : {};
    return { generatedAt: raw.generatedAt ?? 0, ...synced, [key]: raw[key] ?? [] };
  } catch {
    return { generatedAt: 0, [key]: [] };
  }
}

async function writeBundle(file, bundle) {
  await writeFile(file, `${JSON.stringify({ ...bundle, generatedAt: Date.now() }, null, 2)}\n`, 'utf8');
}

async function ingestMarker(issueNumber, author, body) {
  const fields = parseIssueForm(body, MARKER_LABELS);
  const bundle = await readBundle(MARKERS, 'markers');

  const videoId = getYoutubeId(fields.videoUrl);
  if (!videoId) fail('Youtube URL を読み取れませんでした。動画の URL を貼り付けてください。');

  if (bundle.markers.some((m) => !m.deleted && getYoutubeId(m.youtubeUrl) === videoId)) {
    fail('この動画はすでに登録されています。');
  }

  const lat = toNumber(fields.lat);
  const lng = toNumber(fields.lng);
  const errors = validateMarker({ lat, lng, fields });
  if (errors.length > 0) fail(errors.join(' / '));

  let meta;
  try {
    meta = await fetchVideoMeta(videoId);
  } catch (e) {
    fail(e.message);
  }
  const place = await fetchPlace(lat, lng);

  const now = Date.now();
  bundle.markers.push({
    id: `mk_${issueNumber}`,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    lat,
    lng,
    tags: {
      action: fields.tagAction,
      atmosphere: fields.tagAtmosphere,
      emotion: fields.tagEmotion,
    },
    equipment: {
      manufacturer: fields.manufacturer ?? '',
      series: fields.series ?? '',
      model: fields.model ?? '',
    },
    title: meta.title,
    channelTitle: meta.channelTitle,
    thumbnailUrl: meta.thumbnailUrl,
    prefecture: place.prefecture,
    city: place.city,
    createdBy: author,
    createdAt: now,
    updatedAt: now,
  });

  await writeBundle(MARKERS, bundle);
  console.log(`OK: マーカーを追加しました (#${issueNumber} / ${meta.title})`);
  console.log(`現在の登録数: ${bundle.markers.length} 件`);
}

async function ingestRequest(issueNumber, author, body) {
  const fields = parseIssueForm(body, REQUEST_LABELS);
  const bundle = await readBundle(REQUESTS, 'markers');

  const lat = toNumber(fields.lat);
  const lng = toNumber(fields.lng);
  const heat = toNumber(fields.heat);
  const errors = validateRequest({ lat, lng, heat });
  if (errors.length > 0) fail(errors.join(' / '));

  // 1 アカウントあたりの熱量上限（要件）をサーバー側で判定する
  const used = bundle.markers
    .flatMap((m) => m.entries ?? [])
    .filter((e) => e.userId === author)
    .reduce((sum, e) => sum + e.heat, 0);
  if (used + heat > 5) {
    fail(`熱量の上限を超えます。現在 ${used} / 5 を使用中です。`);
  }

  const place = await fetchPlace(lat, lng);
  const now = Date.now();
  const entry = {
    id: `re_${issueNumber}`,
    userId: author,
    heat,
    season: fields.season ?? '',
    timeOfDay: fields.timeOfDay ?? '',
    atmosphere: fields.atmosphere ?? '',
    equipment: {
      manufacturer: fields.manufacturer ?? '',
      series: fields.series ?? '',
      model: fields.model ?? '',
    },
    createdAt: now,
  };

  const spot = bundle.markers.find(
    (m) => Math.abs(m.lat - lat) < SAME_SPOT_EPS && Math.abs(m.lng - lng) < SAME_SPOT_EPS,
  );

  if (spot) {
    spot.entries = [...(spot.entries ?? []), entry];
    spot.totalHeat = spot.entries.reduce((s, e) => s + e.heat, 0);
    spot.requestCount = spot.entries.length;
    spot.updatedAt = now;
  } else {
    bundle.markers.push({
      id: `rq_${issueNumber}`,
      lat,
      lng,
      totalHeat: heat,
      requestCount: 1,
      prefecture: place.prefecture,
      city: place.city,
      updatedAt: now,
      entries: [entry],
    });
  }

  await writeBundle(REQUESTS, bundle);
  console.log(`OK: 撮影リクエストを追加しました (#${issueNumber} / 熱量 ${heat})`);
  console.log(`現在のリクエスト地点数: ${bundle.markers.length} 件`);
}

const kind = process.env.LOCA_ISSUE_KIND;
const issueNumber = process.env.LOCA_ISSUE_NUMBER;
const author = process.env.LOCA_ISSUE_AUTHOR;
const body = process.env.LOCA_ISSUE_BODY;

if (!kind || !issueNumber || !author) fail('必要な環境変数が設定されていません。');

if (kind === 'marker') await ingestMarker(issueNumber, author, body);
else if (kind === 'request') await ingestRequest(issueNumber, author, body);
else fail(`未知の種別です: ${kind}`);
