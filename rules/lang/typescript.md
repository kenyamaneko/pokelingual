> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

# pokelingual TypeScript 固有ルール (overlay)

## [lang/typescript] API 契約 (wire format)

- backend↔frontend の API 契約型は `shared/api-types/*.d.ts` を SSoT とし、backend / frontend で二重定義しない
- JSON のキーは snake_case で統一する (既存契約に準拠。例: `pokemon_id`, `is_legendary`, `attempts_remaining`)
