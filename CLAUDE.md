# CLAUDE.md - pokelingual

> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

共通開発ルールは Key and Notes 共通の `keyandnotes-rules` リポ (兄弟リポとして配置) を SSoT とし、@import で参照する。pokelingual 固有分は `rules/` の overlay に置く。

@../keyandnotes-rules/rules/principles.md
@rules/principles.md

## ファイル編集前のルール適用手順

ファイル編集 (Edit / Write) の前に、対象ファイルのパスから言語を判定し、共通ルール (keyandnotes-rules) と pokelingual 固有 overlay の両方を Read して以降の判断に適用する。共通と pokelingual 固有が衝突する場合は pokelingual を優先する (共通 principles「[base] ルールの階層と優先順位」)。

- `backend/**/*.ts` / `frontend/**/*.ts` / `frontend/**/*.tsx` → `../keyandnotes-rules/rules/lang/typescript.md` + `rules/lang/typescript.md`
- `terraform/**/*.tf` → `../keyandnotes-rules/rules/lang/iac.md`
- `scripts/**/*.py` → `../keyandnotes-rules/rules/lang/python.md`
- テストコードを書くとき → `../keyandnotes-rules/rules/testing.md` + `rules/testing.md`
- ブランチ運用・リリース → `rules/flow.md`

共通 principles (`../keyandnotes-rules/rules/principles.md`) と pokelingual overlay (`rules/principles.md`) は本ファイルから @import 済みなので常に適用される。keyandnotes-rules を兄弟リポとして配置していない場合、共通ルールは読み込まれない。
