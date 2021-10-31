import { z } from 'zod';
import type { CodeBuildEnv } from '../util/aws-cdk';
import { toCodeBuildEnv } from '../util/aws-cdk';

// 環境変数の受け取り

// script: スクリプトの実行レベルで使う
export const scriptOpEnvSchema = z.object({
  OPERATION: z.union([
    z.literal('deploy'),
    z.literal('recreate'),
    z.literal('destroy'),
    z.literal('status'),
    z.literal('db/recreate'),
    z.literal('db/take-snapshot'),
    z.literal('db/recreate-from'),
  ]),
});

export type ScriptOpEnv = z.infer<typeof scriptOpEnvSchema>;

export const scriptOpCodeBuildEnv = (env: ScriptOpEnv): CodeBuildEnv => toCodeBuildEnv<ScriptOpEnv>(env);

// dynamic: 実行時にネームスペースごとに指定する
export const dynamicOpEnvSchema = z.object({
  NAMESPACE: z.string().regex(/[a-z][a-z0-9]*/),
  API_REPO_SHA: z.string(),
  S3BACKEND_PREFIX: z.optional(z.string()),
});

export type DynamicOpEnv = z.infer<typeof dynamicOpEnvSchema>;

export const dynamicOpCodeBuildEnv = (env: DynamicOpEnv): CodeBuildEnv => toCodeBuildEnv<DynamicOpEnv>(env);

// computed: Manager 環境を作ったときに自動で計算して固定して設定する
export const computedOpEnvSchema = z.object({
  API_REPO_NAME: z.string(),
  AWS_ACCOUNT_ID: z.string(),
  S3BACKEND_REGION: z.string(),
  S3BACKEND_BUCKET: z.string(),
  S3BACKEND_PREFIX: z.optional(z.string()),
  NETWORK_VPC_ID: z.string(),
  NETWORK_DB_SG_ID: z.string(),
  NETWORK_LB_SG_ID: z.string(),
  NETWORK_SVC_SG_ID: z.string(),
  NETWORK_PRIV_ID0: z.string(),
  NETWORK_PRIV_ID1: z.string(),
  NETWORK_PRIV_ID2: z.string(),
  NETWORK_PUB_ID0: z.string(),
  NETWORK_PUB_ID1: z.string(),
  NETWORK_PUB_ID2: z.string(),
});

export type ComputedOpEnv = z.infer<typeof computedOpEnvSchema>;

export const computedOpCodeBuildEnv = (env: ComputedOpEnv): CodeBuildEnv => toCodeBuildEnv<ComputedOpEnv>(env);