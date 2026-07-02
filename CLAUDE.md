# CLAUDE.md - pokelingual

> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

@rules/principles.md

## ファイル編集前のルール適用手順

ファイル編集 (Edit / Write) の前に、対象ファイルのパスから言語を判定し、該当するルールを Read して以降の判断に適用する:

- `backend/**/*.ts` / `frontend/**/*.ts` / `frontend/**/*.tsx` → rules/lang/typescript.md
- `terraform/**/*.tf` → rules/lang/iac.md
- `scripts/**/*.py` → rules/lang/python.md
- テストコードを書くとき → rules/testing.md
- ブランチ運用・リリース → rules/flow.md

rules/principles.md は本ファイルから @import 済みなので常に適用される。
