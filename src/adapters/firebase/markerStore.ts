/**
 * Firestore へのマーカーの書き込み（ADR 0012）。
 *
 * ルールに合わせて、作成と本人の更新は必ず writeBatch で rateLimits/{uid} の印と一緒に書く。
 * 時刻はすべて serverTimestamp()。ルールが request.time と一致するかを検査する。
 *
 * Firestore のインスタンスとユーザーの取り出し方を外から受け取るのは、
 * エミュレータのテスト（tests/store/）で同じコードを動かすため。
 */

import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import type { MarkerContent, MarkerData } from '@/core/types';
import type { AuthUser, MarkerStorePort, Unsubscribe } from '@/ports';
import { UpstreamError } from '@/ports';
import { toUpstream } from './errors';

const DENIED =
  '保存が拒否されました。前回の保存から 6 秒以上あけてもう一度お試しください。本人以外のマーカーは変更できません。';
const DUPLICATE = 'この動画はすでに登録されています。';
const BLOCKED = 'この動画は登録できません（管理者が禁止しています）。';
const UNREGISTERED = '投稿するにはプロフィールを登録してください。';
/** アカウント削除で 1 回のバッチに入れるマーカーの数（ルールの get・exists は本番でバッチあたり 20 回まで） */
const DELETE_CHUNK = 3;

/** Firestore は undefined を保存できないので、値の無い項目を落とす。 */
function defined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** 保存する形にする。タグの中の未選択（undefined）も落とす（入れ子の undefined も保存できないため）。 */
function toStored(content: Partial<MarkerContent>): DocumentData {
  const data: DocumentData = defined(content);
  if (content.tags) data.tags = defined(content.tags);
  return data;
}

/** Firestore の行をドメイン型にする。時刻は epoch ms（ADR 0012 決定 2）。 */
function toMarker(id: string, data: DocumentData): MarkerData {
  const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : 0);
  const yt = data.youtube as Record<string, unknown> | undefined;
  return {
    ...(data as Omit<MarkerData, 'id' | 'createdAt' | 'updatedAt'>),
    // Actions が書く再生数など。時刻は Timestamp で来るので epoch ms にする
    youtube: yt ? { ...yt, publishedAt: ms(yt.publishedAt) || undefined, checkedAt: ms(yt.checkedAt) || undefined } : undefined,
    id,
    createdAt: ms(data.createdAt),
    updatedAt: ms(data.updatedAt),
    deleted: data.deleted === true,
  };
}

export function createMarkerStore(db: Firestore, currentUser: () => AuthUser | null): MarkerStorePort {
  const requireUser = (): AuthUser => {
    const user = currentUser();
    if (!user) throw new UpstreamError('保存するにはログインしてください。');
    return user;
  };

  /** 投稿者名にするプロフィールのニックネーム。未登録なら UpstreamError（ルールでも拒否する。ADR 0019）。 */
  const authorOf = async (uid: string): Promise<string> => {
    const nickname = (await getDoc(doc(db, 'users', uid))).data()?.nickname;
    if (typeof nickname !== 'string') throw new UpstreamError(UNREGISTERED);
    return nickname;
  };

  /** 動画の索引の状態。登録前に知らせるため（ルールでも同じことを拒否する）。 */
  const readIndex = async (videoId: string) => {
    const snap = await getDoc(doc(db, 'videos', videoId));
    return snap.exists() ? (snap.data() as { markerId?: string; blocked?: boolean }) : null;
  };

  /** 新しい動画を使えるか。使えなければ理由つきの UpstreamError。 */
  const ensureFree = async (videoId: string) => {
    const index = await readIndex(videoId);
    if (index?.blocked) throw new UpstreamError(BLOCKED);
    if (index) throw new UpstreamError(DUPLICATE);
  };

  /**
   * 印・マーカー・動画の索引を同じバッチで書く。
   * index.add: 新しく作る索引の動画 ID、index.remove: 外す索引の動画 ID（本人が外せるものだけ）。
   */
  const commit = async (
    uid: string,
    markerId: string,
    data: DocumentData,
    mode: 'set' | 'update',
    index: { add?: string; remove?: string } = {},
  ) => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'rateLimits', uid), { lastWriteAt: serverTimestamp(), target: markerId });
    const ref = doc(db, 'markers', markerId);
    if (mode === 'set') batch.set(ref, data);
    else batch.update(ref, data);
    if (index.add) batch.set(doc(db, 'videos', index.add), { markerId, ownerUid: uid });
    if (index.remove) batch.delete(doc(db, 'videos', index.remove));
    try {
      await batch.commit();
    } catch (e) {
      throw toUpstream(e, DENIED);
    }
  };

  /** このマーカーを指していて、禁止の印が無い索引なら外す（論理削除・動画の差し替えのとき）。 */
  const releasable = async (markerId: string, videoId: string | undefined) => {
    if (!videoId) return undefined;
    const index = await readIndex(videoId);
    return index && index.markerId === markerId && !index.blocked ? videoId : undefined;
  };

  const currentVideoId = async (markerId: string): Promise<string | undefined> => {
    const snap = await getDoc(doc(db, 'markers', markerId));
    return snap.exists() ? (snap.data().videoId as string | undefined) : undefined;
  };

  return {
    name: 'firestore',

    async probe(): Promise<boolean> {
      return true;
    },

    async create(content: MarkerContent): Promise<string> {
      const user = requireUser();
      const createdBy = await authorOf(user.uid);
      await ensureFree(content.videoId);
      const id = doc(collection(db, 'markers')).id;
      const data = {
        ...toStored(content),
        ownerUid: user.uid,
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deleted: false,
      };
      await commit(user.uid, id, data, 'set', { add: content.videoId });
      return id;
    },

    async update(id: string, patch: Partial<MarkerContent>): Promise<void> {
      const user = requireUser();
      const before = await currentVideoId(id);
      const moving = patch.videoId !== undefined && patch.videoId !== before;
      if (moving) await ensureFree(patch.videoId as string);
      const index = moving ? { add: patch.videoId, remove: await releasable(id, before) } : {};
      const data = toStored(patch);
      // 現地メモを空にした更新は、項目ごと消す（落とすだけだと古いメモが残る）
      if ('memo' in patch && patch.memo === undefined) data.memo = deleteField();
      await commit(user.uid, id, { ...data, updatedAt: serverTimestamp() }, 'update', index);
    },

    async softDelete(id: string): Promise<void> {
      const user = requireUser();
      const remove = await releasable(id, await currentVideoId(id));
      await commit(user.uid, id, { deleted: true, updatedAt: serverTimestamp() }, 'update', { remove });
    },

    async softDeleteAllMine(): Promise<number> {
      const user = requireUser();
      try {
        const snap = await getDocs(query(collection(db, 'markers'), where('ownerUid', '==', user.uid)));
        const alive = snap.docs.filter((d) => d.data().deleted !== true);
        // 1 件につき、マーカーの更新と索引の削除でルールの get・exists が 5 回ほど走る。バッチあたり 20 回に収める
        for (let i = 0; i < alive.length; i += DELETE_CHUNK) {
          const chunk = alive.slice(i, i + DELETE_CHUNK);
          const releases = await Promise.all(chunk.map((d) => releasable(d.id, d.data().videoId as string | undefined)));
          const batch = writeBatch(db);
          chunk.forEach((d, j) => {
            batch.update(d.ref, { deleted: true, updatedAt: serverTimestamp() });
            const videoId = releases[j];
            if (videoId) batch.delete(doc(db, 'videos', videoId));
          });
          await batch.commit();
        }
        return alive.length;
      } catch (e) {
        throw e instanceof UpstreamError ? e : toUpstream(e, 'マーカーを削除できませんでした。');
      }
    },

    subscribeChanges(sinceMs, onChange, onError): Unsubscribe {
      // 差分だけを読む（読み取りの無料枠を守るため。要件 1.4）。単一項目の範囲条件なので複合インデックスは要らない
      const changed = query(collection(db, 'markers'), where('updatedAt', '>', Timestamp.fromMillis(sinceMs)));
      return onSnapshot(
        changed,
        (snap) => {
          // 自分の保存直後は serverTimestamp が未確定なので、端末の時計で見積もった値を使う
          const rows = snap
            .docChanges()
            .filter((c) => c.type !== 'removed')
            .map((c) => toMarker(c.doc.id, c.doc.data({ serverTimestamps: 'estimate' })));
          if (rows.length > 0) onChange(rows);
        },
        (e) => onError(toUpstream(e, DENIED)),
      );
    },
  };
}
