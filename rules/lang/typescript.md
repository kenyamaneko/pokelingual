> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

# pokelingual TypeScript 固有ルール (overlay)

共通ルール (`keyandnotes-rules` の `rules/lang/typescript.md`) を土台に、pokelingual 固有分を定義する。CLAUDE.md の「ファイル編集前のルール適用手順」に従い、TS/TSX 編集時に共通とあわせて Read する。

## [lang/typescript] API 契約 (wire format)

- backend↔frontend の API 契約型は `shared/api-types/*.d.ts` を SSoT とし、backend / frontend で二重定義しない
- JSON のキーは snake_case で統一する (既存契約に準拠。例: `pokemon_id`, `is_legendary`, `attempts_remaining`)
