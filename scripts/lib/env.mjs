/**
 * スクリプト用の設定値の読み取り。環境変数（Actions の Variables）を優先し、無ければ .env.local を読む。
 * 値そのものは呼び出し側でも出力しないこと。
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function envValue(key, root = process.cwd()) {
  if (process.env[key]) return process.env[key].trim();
  try {
    const text = await readFile(path.join(root, '.env.local'), 'utf8');
    const line = text.split(/\r?\n/).find((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
    return line ? line.replace(/^[^=]*=/, '').trim().replace(/^"|"$/g, '') : '';
  } catch {
    return '';
  }
}

/** Firestore の REST API を未ログインで呼ぶための設定。足りなければ null。 */
export async function firestoreConfig(root = process.cwd()) {
  const apiKey = await envValue('VITE_FIREBASE_API_KEY', root);
  const projectId = await envValue('VITE_FIREBASE_PROJECT_ID', root);
  if (!apiKey || !projectId) return null;
  return {
    apiKey,
    projectId,
    base: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`,
  };
}
