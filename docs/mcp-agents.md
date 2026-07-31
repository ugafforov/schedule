# Agentlar boʻyicha MCP config va yoʻriqnoma fayllari

Qoidalarning yagona manbasi — `AGENTS.md`. Bu fayl faqat qaysi agent qaysi config va
yoʻriqnoma faylini oʻqishini roʻyxatlaydi.

| Agent | MCP config | Yoʻriqnoma |
|---|---|---|
| Claude Code | `.mcp.json` | `CLAUDE.md` → `@AGENTS.md` |
| VS Code Copilot | `.vscode/mcp.json` | `.github/copilot-instructions.md` → havola |
| Cursor | `.cursor/mcp.json` | `AGENTS.md` (oʻzi oʻqiydi) |
| Trae | `.trae/mcp.json` | `.trae/rules/project_rules.md` → havola |
| Codex CLI | `.codex/config.toml` (trusted project shart) | `AGENTS.md` (oʻzi oʻqiydi) |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` (global) | `.windsurfrules` → havola |
| Antigravity | `~/.gemini/config/mcp_config.json` (global) | `AGENTS.md` |

Yoʻriqnoma fayllari **faqat havola**, nusxa emas — qoidalar faqat `AGENTS.md`da. Claude Code
uchun `~/.claude.json`da global MCP nusxasi ham bor; loyiha `.mcp.json`i ustun turadi (takror
ataylab — `~/.claude.json`ni faqat Claude Code oʻqiydi).

Versiyalar barcha configda bir xil qotirilishi shart — sabab va aniq versiyalar `AGENTS.md`
→ "MCP serverlari" boʻlimida.

Token: `AGENTS.md` → "Muhit oʻzgaruvchilari". Tokenni hech qachon commit qilinadigan faylga yozmang.
