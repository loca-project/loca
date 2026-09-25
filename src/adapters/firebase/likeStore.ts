/**
 * Firestore へのいいねの書き込み（firestore.rules の「いいね」。ADR 0024）。
 *
 * likes/{markerId}_{uid} と件数 likeCounts/{markerId} を同じトランザクションで書く。
 * 件数がちょうど 1 動かない書き込みはルールが拒否するので、同時に付けられたときはトランザクションが読み直して再試行する。
 * 付けるときだけ rateLimits/{uid} に印を付ける（マーカーの保存と同じ 6 秒の間隔）。
 */

import {
  collection,
  doc,
  getDoc,
  getAggregateFromServer,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  sum,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { AuthUser, LikeState, LikeStorePort } from '@/ports';
import { UpstreamError } from '@/ports';
import { toUpstream } from './errors';

const DENIED = 'いいねが拒否されました。自分のマーカーと削除されたマーカーには付けられません。続けて付けるときは数秒あけてください。';

export function createLikeStore(db: Firestore, currentUser: () => AuthUser | null): LikeStorePort {
  const countOf = (data: { count?: unknown } | undefined): number => Number(data?.count ?? 0);

  /** 本人のいいねを付ける・外す。すでにその状態なら何も書かずに今の状態を返す。 */
  const toggle = async (uid: string, marker: { id: string; ownerUid: string }, want: boolean): Promise<LikeState> => {
    const likeRef = doc(db, 'likes', `${marker.id}_${uid}`);
    const countRef = doc(db, 'likeCounts', marker.id);
    try {
      return await runTransaction(db, async (tx) => {
        const like = await tx.get(likeRef);
        const counter = await tx.get(countRef);
        const liked = like.exists() && like.data().deleted === false;
        const count = countOf(counter.data());
        if (liked === want) return { count, liked };

        if (like.exists()) tx.update(likeRef, { deleted: !want, updatedAt: serverTimestamp() });
        else {
          tx.set(likeRef, {
            markerId: marker.id,
            likerUid: uid,
            deleted: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        // 件数の文書が無いのは、最初のいいねか、マーカーごと物理削除されたあと（外すだけ。件数は動かさない）
        const next = count + (want ? 1 : -1);
        if (counter.exists()) tx.update(countRef, { count: next });
        else if (want) tx.set(countRef, { count: 1, ownerUid: marker.ownerUid });
        if (want) tx.set(doc(db, 'rateLimits', uid), { lastWriteAt: serverTimestamp(), target: marker.id });
        return { count: counter.exists() || want ? next : 0, liked: want };
      });
    } catch (e) {
      throw toUpstream(e, DENIED);
    }
  };

  return {
    name: 'firestore-likes',

    async probe(): Promise<boolean> {
      return true;
    },

    async state(markerId: string): Promise<LikeState> {
      const user = currentUser();
      try {
        const [counter, mine] = await Promise.all([
          getDoc(doc(db, 'likeCounts', markerId)),
          user ? getDoc(doc(db, 'likes', `${markerId}_${user.uid}`)) : Promise.resolve(null),
        ]);
        return { count: countOf(counter.data()), liked: mine?.exists() === true && mine.data().deleted === false };
      } catch (e) {
        throw toUpstream(e, 'いいねの件数を読み込めませんでした。');
      }
    },

    async set(marker, liked): Promise<LikeState> {
      const user = currentUser();
      if (!user) throw new UpstreamError('いいねするにはログインしてください。');
      return toggle(user.uid, marker, liked);
    },

    async receivedByMine(): Promise<Record<string, number>> {
      const user = currentUser();
      if (!user) return {};
      try {
        const snap = await getDocs(query(collection(db, 'likeCounts'), where('ownerUid', '==', user.uid)));
        const received: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const count = countOf(d.data());
          if (count > 0) received[d.id] = count;
        });
        return received;
      } catch (e) {
        throw toUpstream(e, '受け取ったいいねを読み込めませんでした。');
      }
    },

    async totalFor(ownerUid: string): Promise<number> {
      try {
        const snap = await getAggregateFromServer(query(collection(db, 'likeCounts'), where('ownerUid', '==', ownerUid)), {
          total: sum('count'),
        });
        return Number(snap.data().total ?? 0);
      } catch (e) {
        throw toUpstream(e, 'いいねの合計を読み込めませんでした。');
      }
    },

    async unlikeAllMine(): Promise<number> {
      const user = currentUser();
      if (!user) throw new UpstreamError('いいねを外すにはログインしてください。');
      let liked: string[];
      try {
        const snap = await getDocs(query(collection(db, 'likes'), where('likerUid', '==', user.uid)));
        liked = snap.docs.filter((d) => d.data().deleted === false).map((d) => String(d.data().markerId));
      } catch (e) {
        throw toUpstream(e, 'いいねを読み込めませんでした。');
      }
      // 件数の文書はマーカーごとに別なので 1 件ずつ外す。外すのに印は要らない（ルール）。投稿者の uid は外すときには使わない
      for (const markerId of liked) await toggle(user.uid, { id: markerId, ownerUid: '' }, false);
      return liked.length;
    },
  };
}
