import { CodeBuild } from '@aws-sdk/client-codebuild';
import type { Temporal } from '@js-temporal/polyfill';
import { toTemporalInstant } from '@js-temporal/polyfill';
import { z } from 'zod';
import type { ScriptOpEnv } from '@self/shared/lib/operate-env/op-env';
import { dynamicOpCodeBuildEnv, scriptOpCodeBuildEnv } from '@self/shared/lib/operate-env/op-env';
import { dynamicRunScriptCodeBuildEnv } from '@self/shared/lib/run-script/env';
import type { BuiltInfo } from '@self/shared/lib/operate-env/build-output';
import {
  tfBuildOutputSchema,
  generalBuildOutputSchema,
  runTaskBuildOutputSchema,
} from '@self/shared/lib/operate-env/build-output';
import type { ReplyCmd, ReplyCmdStatic } from '@self/bot/src/type/cmd';
import { renderDuration, renderTimestamp } from '@self/bot/src/util/comment-render';
import { renderECRImageDigest } from '@self/bot/src/util/comment-render/aws';
import { getImageDetailByTag } from '@self/bot/src/util/aws/ecr';
import type { ComputedBotEnv } from '@self/shared/lib/bot/env';

// TODO(hardcoded)
const imageRegion = 'ap-northeast-1';

const entrySchema = z
  .object({
    prNumber: z.number(),
    buildId: z.string(),
    buildArn: z.string(),
    webImageDigest: z.string(),
    apiImageDigest: z.string(),
  })
  .merge(generalBuildOutputSchema)
  .merge(tfBuildOutputSchema)
  .merge(runTaskBuildOutputSchema);
export type Entry = z.infer<typeof entrySchema>;

export interface CommentValues {
  buildStatus: string;
  statusChangedAt: Temporal.Instant;
  deepLogLink?: string | null;
  builtInfo?: BuiltInfo | null;
}

interface CreateParams {
  operation: ScriptOpEnv['OPERATION'];
}

export const argSchema = {} as const;
export type ArgSchema = typeof argSchema;

const createCmd = (
  st: ReplyCmdStatic,
  paramsGetter: (env: ComputedBotEnv) => CreateParams,
): ReplyCmd<Entry, CommentValues, ArgSchema> => {
  const cmd: ReplyCmd<Entry, CommentValues, ArgSchema> = {
    ...st,
    entrySchema,
    argSchema,
    async main(ctx, _args, generalEntry) {
      const { number: prNumber } = ctx.commentPayload.issue;
      const { credentials, logger } = ctx;

      const apiImageDetail = await getImageDetailByTag(
        {
          imageRegion,
          imageRepoName: ctx.env.API_REPO_NAME,
          imageTag: ctx.namespace,
        },
        credentials,
        logger,
      );
      if (!apiImageDetail) throw new Error('Image for API not found.');

      const webImageDetail = await getImageDetailByTag(
        {
          imageRegion,
          imageRepoName: ctx.env.WEB_REPO_NAME,
          imageTag: ctx.namespace,
        },
        credentials,
        logger,
      );
      if (!webImageDetail) throw new Error('Image for WEB not found.');

      const codeBuild = new CodeBuild({ credentials, logger });
      const r = await codeBuild.startBuild({
        projectName: ctx.env.OPERATE_ENV_PROJECT_NAME,
        environmentVariablesOverride: [
          ...dynamicRunScriptCodeBuildEnv({
            ENTRY_UUID: generalEntry.uuid,
          }),
          ...scriptOpCodeBuildEnv({
            OPERATION: paramsGetter(ctx.env).operation,
          }),
          ...dynamicOpCodeBuildEnv({
            TERRAFORM_VERSION: '1.0.9',
            NAMESPACE: ctx.namespace,
            API_REPO_SHA: apiImageDetail.imageDigest,
            WEB_REPO_SHA: webImageDetail.imageDigest,
          }),
        ],
      });

      const { build } = r;
      if (build == null) throw new TypeError('Response not found for CodeBuild.startBuild');
      if (typeof build.buildStatus !== 'string') throw new TypeError('CodeBuild response buildStatus is not string');
      if (typeof build.id !== 'string') throw new TypeError('CodeBuild response id is not string');
      if (typeof build.arn !== 'string') throw new TypeError('CodeBuild response arn is not string');
      if (build.startTime == null) throw new TypeError('CodeBuild response startTime is not Date');

      const entry: Entry = {
        prNumber,
        buildId: build.id,
        buildArn: build.arn,
        webImageDigest: webImageDetail.imageDigest,
        apiImageDigest: apiImageDetail.imageDigest,
      };

      const values: CommentValues = {
        buildStatus: build.buildStatus,
        statusChangedAt: toTemporalInstant.call(build.startTime),
      };

      return {
        status: 'undone',
        entry,
        values,
      };
    },
    constructComment(entry, values, ctx) {
      // TODO(hardcoded)
      const region = 'ap-northeast-1';
      const buildUrl = `https://${region}.console.aws.amazon.com/codesuite/codebuild/projects/${
        ctx.env.OPERATE_ENV_PROJECT_NAME
      }/build/${encodeURIComponent(entry.buildId)}/?region=${region}`;
      const { builtInfo } = values;
      return {
        main: [
          `- ビルドステータス: ${values.buildStatus} (${renderTimestamp(values.statusChangedAt)})`,
          builtInfo && `- ビルド時間: ${builtInfo.timeRange}`,
          ...(entry.tfBuildOutput
            ? [`- api: ${entry.tfBuildOutput.apiURL}`, `- web: ${entry.tfBuildOutput.webURL}`]
            : []),
        ],
        hints: [
          {
            title: '詳細',
            body: {
              main: [
                `- ビルドID: [${entry.buildId}](${buildUrl})`,
                ...(entry.tfBuildOutput
                  ? [
                      `- ECS Cluster Name: [\`${entry.tfBuildOutput.ecsClusterName}\`](https://${entry.tfBuildOutput.envRegion}.console.aws.amazon.com/ecs/home#/clusters/${entry.tfBuildOutput.ecsClusterName}/services)`,
                    ]
                  : []),
                `- 使用した Web イメージダイジェスト: ${renderECRImageDigest({
                  imageRegion,
                  imageDigest: entry.webImageDigest,
                  imageRepoName: ctx.env.WEB_REPO_NAME,
                })}`,
                `- 使用した API イメージダイジェスト: ${renderECRImageDigest({
                  imageRegion,
                  imageDigest: entry.apiImageDigest,
                  imageRepoName: ctx.env.API_REPO_NAME,
                })}`,
                entry.generalBuildOutput &&
                  `- 使用したインフラ定義バージョン: ${entry.generalBuildOutput.sourceZipKey}`,
                ...(entry.tfBuildOutput && entry.runTaskBuildOutput
                  ? [
                      `[RunTask の詳細ログ (CloudWatch Logs)](https://${
                        entry.tfBuildOutput.envRegion
                      }.console.aws.amazon.com/cloudwatch/home#logsV2:log-groups/log-group/${
                        entry.tfBuildOutput.apiTaskLogGroupName
                      }/log-events/api${'$252F'}api${'$252F'}${entry.runTaskBuildOutput})`,
                    ]
                  : []),
                values.deepLogLink && `- [ビルドの詳細ログ (CloudWatch Logs)](${values.deepLogLink})`,
              ],
            },
          },
        ],
      };
    },
    async update(entry, ctx) {
      const { credentials, logger } = ctx;
      const codeBuild = new CodeBuild({ credentials, logger });
      const r = await codeBuild.batchGetBuilds({
        ids: [entry.buildId],
      });
      const { builds } = r;
      ctx.logger.info('builds', { builds });
      if (builds == null) throw new TypeError('builds not found');
      const first = builds[0];
      const last = builds[builds.length - 1];
      if (typeof last.buildStatus !== 'string') throw new TypeError('CodeBuild last buildStatus is not string');
      const firstStartTime = first.startTime;
      const lastStartTime = last.startTime;
      const lastEndTime = last.endTime;
      if (firstStartTime == null) throw new TypeError('CodeBuild first startTime is not found');
      if (lastStartTime == null) throw new TypeError('CodeBuild last startTime is not found');

      const computeBuiltInfo = async (): Promise<BuiltInfo | null> => {
        const timeRange = renderDuration(
          toTemporalInstant.call(firstStartTime).until(toTemporalInstant.call(lastEndTime ?? lastStartTime)),
        );

        return {
          timeRange,
        };
      };

      ctx.logger.info('Get last status.', { buildStatus: last.buildStatus });
      const builtInfo = last.buildStatus === 'SUCCEEDED' ? await computeBuiltInfo() : null;
      ctx.logger.info('Built info.', { builtInfo });

      const values: CommentValues = {
        buildStatus: last.buildStatus,
        statusChangedAt: toTemporalInstant.call(lastEndTime ?? lastStartTime),
        deepLogLink: last.logs?.deepLink,
        builtInfo,
      };

      return {
        status: ({ SUCCEEDED: 'success', FAILED: 'failure' } as const)[last.buildStatus] ?? 'undone',
        entry,
        values,
      };
    },
  };
  return cmd;
};

export default createCmd;
