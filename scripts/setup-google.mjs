/**
 * Actions から YouTube Data API と Firestore を使うための Google Cloud の設定（T23・ADR 0017）。
 * 何度流しても同じ結果になる（あるものは作らず、足りないものだけ作る）。
 *
 * 1. API を有効にする（YouTube Data API・IAM・STS・IAM Credentials・API Keys・Resource Manager）
 * 2. YouTube Data API だけに制限した API キーを作り、GitHub Secrets の YOUTUBE_API_KEY に入れる
 * 3. Actions 用のサービスアカウントを作り、Firestore の読み書き（roles/datastore.user）を付ける
 * 4. Workload Identity 連携（GitHub の OIDC）を作り、このリポジトリの Actions だけがなりすませるようにする
 * 5. GitHub Variables に GCP_WORKLOAD_IDENTITY_PROVIDER と GCP_SERVICE_ACCOUNT を入れる
 *
 * 請求先は使わない。有効化に請求先が要る API があれば、そこで止まる。
 * API キーの値は画面にもログにも出さず、gh に標準入力で渡す。
 *
 * 実行: node scripts/setup-google.mjs（Firebase CLI にオーナーでログインしていること）
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { PROJECT, call, fail, ownerToken } from './lib/owner-auth.mjs';

const REPO = 'loca-project/loca-project.github.io';
const APIS = [
  'youtube.googleapis.com',
  'iam.googleapis.com',
  'iamcredentials.googleapis.com',
  'sts.googleapis.com',
  'apikeys.googleapis.com',
  'cloudresourcemanager.googleapis.com',
];
const KEY_ID = 'loca-youtube';
const SA_ID = 'loca-actions';
const SA_EMAIL = `${SA_ID}@${PROJECT}.iam.gserviceaccount.com`;
const POOL = 'github';
const PROVIDER = 'loca-repo';

const { token } = await ownerToken();
const api = (method, url, body) => call(token, method, url, body);
const done = (label) => console.log(`OK  ${label}`);

/** 長く掛かる操作（operation）の完了を待つ。 */
async function waitOperation(base, op) {
  for (let i = 0; i < 60 && op && !op.done; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    op = await api('GET', `${base}/${op.name}`);
  }
  if (op?.error) fail(`${op.name}: ${JSON.stringify(op.error)}`);
  return op;
}

// 1. API
const serviceUsage = 'https://serviceusage.googleapis.com/v1';
const states = await Promise.all(APIS.map((s) => api('GET', `${serviceUsage}/projects/${PROJECT}/services/${s}`)));
const disabled = APIS.filter((_, i) => states[i]?.state !== 'ENABLED');
if (disabled.length > 0) {
  const op = await api('POST', `${serviceUsage}/projects/${PROJECT}/services:batchEnable`, { serviceIds: disabled });
  await waitOperation(serviceUsage, op);
}
done(`API を有効化（新たに ${disabled.length} 件）`);

const project = await api('GET', `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}`);
const projectNumber = project.projectNumber;

// 2. API キー（YouTube Data API だけ）
const keys = 'https://apikeys.googleapis.com/v2';
const keyName = `projects/${projectNumber}/locations/global/keys/${KEY_ID}`;
if (!(await api('GET', `${keys}/${keyName}`))) {
  const op = await api('POST', `${keys}/projects/${PROJECT}/locations/global/keys?keyId=${KEY_ID}`, {
    displayName: 'Loca Actions - YouTube Data API',
    restrictions: { apiTargets: [{ service: 'youtube.googleapis.com' }] },
  });
  await waitOperation(keys, op);
}
const { keyString } = await api('GET', `${keys}/${keyName}/keyString`);
// gh は VS Code を再起動するまで PATH に載らないことがある
const GH_EXE = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const gh = existsSync(GH_EXE) ? GH_EXE : 'gh';
const runGh = (args, input) => execFileSync(gh, args, { input, stdio: ['pipe', 'ignore', 'inherit'] });
runGh(['secret', 'set', 'YOUTUBE_API_KEY', '-R', REPO], keyString);
done('API キー（YouTube Data API だけ）を Secrets の YOUTUBE_API_KEY に登録');

// 3. サービスアカウントと Firestore の権限
const iam = 'https://iam.googleapis.com/v1';
if (!(await api('GET', `${iam}/projects/${PROJECT}/serviceAccounts/${SA_EMAIL}`))) {
  await api('POST', `${iam}/projects/${PROJECT}/serviceAccounts`, {
    accountId: SA_ID,
    serviceAccount: { displayName: 'Loca GitHub Actions', description: '日次の Actions が Firestore を読み書きする（ADR 0017）' },
  });
}
/** IAM ポリシーに role と member の組を足す（既にあれば何もしない）。 */
async function grant(getUrl, setUrl, role, member) {
  const policy = await api('POST', getUrl, {});
  const bindings = policy.bindings ?? [];
  const binding = bindings.find((b) => b.role === role);
  if (binding?.members.includes(member)) return;
  if (binding) binding.members.push(member);
  else bindings.push({ role, members: [member] });
  await api('POST', setUrl, { policy: { ...policy, bindings } });
}
const crm = `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}`;
await grant(`${crm}:getIamPolicy`, `${crm}:setIamPolicy`, 'roles/datastore.user', `serviceAccount:${SA_EMAIL}`);
done(`サービスアカウント ${SA_EMAIL} に roles/datastore.user`);

// 4. Workload Identity 連携
const pools = `${iam}/projects/${PROJECT}/locations/global/workloadIdentityPools`;
if (!(await api('GET', `${pools}/${POOL}`))) {
  const op = await api('POST', `${pools}?workloadIdentityPoolId=${POOL}`, { displayName: 'GitHub Actions' });
  await waitOperation(iam, op);
}
if (!(await api('GET', `${pools}/${POOL}/providers/${PROVIDER}`))) {
  const op = await api('POST', `${pools}/${POOL}/providers?workloadIdentityPoolProviderId=${PROVIDER}`, {
    displayName: 'loca-project.github.io',
    attributeMapping: { 'google.subject': 'assertion.sub', 'attribute.repository': 'assertion.repository' },
    // このリポジトリの Actions だけを受け入れる
    attributeCondition: `assertion.repository == '${REPO}'`,
    oidc: { issuerUri: 'https://token.actions.githubusercontent.com' },
  });
  await waitOperation(iam, op);
}
const principal = `principalSet://iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}`;
const saUrl = `${iam}/projects/${PROJECT}/serviceAccounts/${SA_EMAIL}`;
await grant(`${saUrl}:getIamPolicy`, `${saUrl}:setIamPolicy`, 'roles/iam.workloadIdentityUser', principal);
done(`Workload Identity 連携（${REPO} の Actions だけ）`);

// 5. GitHub Variables（公開してよい識別子だけ）
const providerName = `projects/${projectNumber}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}`;
runGh(['variable', 'set', 'GCP_WORKLOAD_IDENTITY_PROVIDER', '-R', REPO, '--body', providerName]);
runGh(['variable', 'set', 'GCP_SERVICE_ACCOUNT', '-R', REPO, '--body', SA_EMAIL]);
done('Variables に GCP_WORKLOAD_IDENTITY_PROVIDER と GCP_SERVICE_ACCOUNT を登録');
