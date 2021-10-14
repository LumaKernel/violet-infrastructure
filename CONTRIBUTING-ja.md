# CONTRIBUTING

WIP

## Links

- https://www.hashicorp.com/blog/cdk-for-terraform-enabling-python-and-typescript-support
- https://github.com/hashicorp/terraform-provider-aws
- https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/CHAP_TemplateQuickRef.html
- Examples
  - https://github.com/hashicorp/terraform-cdk

## Development Cycle

- `cdktf` cli は直接使わずに npm scripts 経由で使用します。
- `cp .env.local.example .env.local` とし、 `.env.local` で必要な設定をコメントに沿って設定してください。
- `pnpm deploy:manager`, `pnpm deploy:env` でデプロイできます。コンパイルはしてくれます。
- `manager`: 管理層になります。いろいろな設定値のインフラを作る上で、一個だけ存在しておけばよいというもの
- `env`: 各環境向けのインフラ郡の単位
- S3 バックエンド設定を行って manager 自体の更新は CLI で直接行います
  - TODO: ここは CI/CD 自動化の余地がある

## Rules

- すべてのリソースについて、 `new` したものを変数に格納します
- terraform 用のリソース名と、格納先の変数名を同一にします
  - :+1: これにより、変数スコープで名前の衝突回避をします
  - :+1: 考えるべき名前が一つ減ります
- 環境変数は直接参照せずに util/env-vars.ts にまとめます。

## TODO comment scopes

以下のスコープに分類できない TODO は残さない。

- (service): サービス品質に関する
- (security): セキュリティに関する
- (logging): ログに関する
- (cost): コストに関する
- (scale): スケーリングに関する
- (perf): パフォーマンスに関する
- (hardcoded): ハードコーディングされている
- (extended): 拡張可能にできる。必要になったときに限り考える

## FAQ

- テンプレートと構造を変えた部分はどこですか
  - 複数の環境を管理します
  - ステートファイル類は `.state/<name>/` 配下で管理
  - `.gen/` すべての環境で同じものを使う、固定するというところで git 管理しています
    - `pnpm run get` で更新します