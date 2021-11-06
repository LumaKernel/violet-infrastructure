import { z } from 'zod';
import type { CodeBuildEnv } from '@self/shared/lib/util/aws-cdk';
import { toCodeBuildEnv } from '@self/shared/lib/util/aws-cdk';

export const botSecretsSchema = z.object({
  WEBHOOKS_SECRET: z.string(),
  BOT_APP_ID: z.string(),
  BOT_PRIVATE_KEY: z.string(),
});
export type BotSecrets = z.infer<typeof botSecretsSchema>;

export const computedBotEnvSchema = z.object({
  PREVIEW_DOMAIN: z.string(),
  INFRA_SOURCE_BUCKET: z.string(),
  INFRA_SOURCE_ZIP_KEY: z.string(),
  BOT_TABLE_NAME: z.string(),
  BOT_SSM_PREFIX: z.string(),
});
export type ComputedBotEnv = z.infer<typeof computedBotEnvSchema>;
export const computedBotCodeBuildEnv = (env: ComputedBotEnv): CodeBuildEnv => toCodeBuildEnv<ComputedBotEnv>(env);

export const computedAfterwardBotEnvSchema = z.object({
  API_REPO_NAME: z.string(),
  WEB_REPO_NAME: z.string(),
  LAMBDA_REPO_NAME: z.string(),
  API_BUILD_PROJECT_NAME: z.string(),
  WEB_BUILD_PROJECT_NAME: z.string(),
  LAMBDA_BUILD_PROJECT_NAME: z.string(),
  OPERATE_ENV_PROJECT_NAME: z.string(),
  PR_UPDATE_LABELS_PROJECT_NAME: z.string(),
});
export type ComputedAfterwardBotEnv = z.infer<typeof computedAfterwardBotEnvSchema>;