# FrankenMCP — Build Plan for Antigravity

> 给 Antigravity 的实施方案（Kiroween 2026，Frankenstein 类别）。
> 目标：4 周内交付一个可参赛、可演示、可部署的 FrankenMCP。截止：2026-12-04 14:00 PT（北京时间 12-05 06:00）。
> 语言：代码、注释、文档、UI 全部用英文（评审要求）。

## 1. 项目一句话

**FrankenMCP** — a web app that stitches multiple incompatible MCP servers together through a dynamic router, with a live "Monster Lab" dashboard showing, per turn, which tools were loaded, which were trimmed, and how much context was saved.

用户故事：a solo founder runs their whole business stack (notes, tasks, docs, web) through one chat, instead of connecting five MCP servers and watching the agent drown in 100+ tool definitions.

## 2. 硬性约束（违反 = 取消资格，不要碰）

1. **全新公开仓库**：新建 `leethoneid/frankenmcp`（不要复用现有仓库）。协议用 **MIT**（不要用 PolyForm Noncommercial——评审要"可检测的开源协议"）。
2. **仓库根目录必须有 `/.kiro`**，且不得写进 `.gitignore`。
3. **商业部分绝不进这个仓库**：Ed25519 授权、Gumroad Pro 构建、任何 licence key / 商业 DRM 代码一律不放。参赛的只是开源版 FrankenMCP。
4. **复用旧代码要披露**：动态路由器复用作者已有的开源项目 `leethoneid/mcp-dynamic-router`——作为依赖引用（npm/git dependency），不要把它的代码整段拷进来，并在 README 的 "Prior work" 一节写明：router core is a pre-existing open-source component by the same author, reused as a dependency; everything else in this repo was built 2026-10-30 – 2026-12-04 for Kiroween.
5. **不许编造 Kiro 使用记录**：`/.kiro` 里的 spec、steering、hooks 必须是真实走 Kiro 流程产生的（见 §6）。不要只贴一个空目录充数——"Insufficient use of Kiro" 会直接取消资格。
6. **不要放任何密钥**：演示用的 MCP 服务器全部用本地 mock / 无需 key 的公开接口；GitHub 等需要 token 的服务器做成可选，并写明需要用户自带 token。
7. 演示站点必须评委免 VPN 可达（Vercel），且免费开放到评审结束（2027-01-29）。

## 3. 技术栈

- **语言/框架**：TypeScript + Next.js (App Router) + Tailwind CSS。单仓库、单应用。
- **MCP**：`@modelcontextprotocol/sdk`（client + server）。路由器用 `mcp-dynamic-router`（依赖）。
- **测试**：Vitest + fast-check（PBT，见 §5）。
- **部署**：Vercel（免费层）。不要用需要翻墙才能访问的托管。
- **包管理**：npm。锁文件提交进仓库。

## 4. 功能清单（按优先级）

### P0 — 没有就没法参赛
1. **MCP 服务器注册**：UI 里添加/删除 MCP 服务器（stdio 本地命令、SSE、Streamable HTTP 三种传输）。每个服务器显示连接状态、工具列表。
2. **动态路由 + schema 裁剪**：用户发一句话，路由器只把相关服务器的工具暴露给 agent；无关工具的 schema 被裁掉。核心不变量（见 §5 PBT）。
3. **Playground 对话框**：一个能真正跑通的聊天界面。用户提问 → 路由 → 调用工具 → 返回答案。每轮回答下方显示"本轮用了哪些服务器/工具"。
4. **Monster Lab 仪表盘**：实时展示每轮：加载的工具数、裁掉的工具数、省下的上下文 token 估算、各服务器健康状态。数字要真实从运行里算出来，不要写死。
5. **3 个内置演示 MCP 服务器**（仓库自带、开箱即用、零 key）：
   - `notes`：本地笔记增删改查（内存/JSON 文件存储）；
   - `tasks`：待办清单增删改查；
   - `calculator`：四则运算 + 单位换算（演示"工具调用"最直观）。
   每个都是标准 MCP server（stdio），由 `.kiro/settings/mcp.json` 预配好。
6. **公开仓库 + MIT + `/.kiro`**（见 §6）。

### P1 — 有了能多拿分
7. **可选的第 4 个服务器**：GitHub 只读服务器（列仓库/读 README），需要用户填自己的 token 才能连；默认关闭。
8. **每轮路由解释**：一句话说明"为什么选了这几个服务器"（基于意图关键词/向量相似度，诚实写实现方式，不要假装用了没用的模型）。
9. **导出/分享**：一键复制本轮的路由决策 JSON（方便写 Devpost 说明）。

### P2 — 时间不够就砍
10. Kiro Crew 健康巡检 bot（另算 $1,000 Best Kiro Crew App 奖，独立仓库，不阻塞主提交）。

## 5. 路由器不变量（PBT，每条 ≥100 个 fast-check 用例）

1. **裁剪不丢必需参数**：trimming 之后，任何被保留工具的 required 参数必须完整保留。
2. **路由确定性**：同一输入意图 + 同一服务器集合 → 同一路由决策。
3. **Schema 往返保真**：tool schema 经过裁剪再还原（或重新加载）后，与原始 schema 一致。

PBT 测试放在 `tests/`，每个测试标注它验证的 requirements.md 条目编号。

## 6. `/.kiro` 目录（必须真实、可用）

```
.kiro/
  specs/
    router-core/requirements.md | design.md | tasks.md       # EARS 写法
    monster-lab-dashboard/requirements.md | design.md | tasks.md
    playground-chat/requirements.md | design.md | tasks.md
    deployment/requirements.md | design.md | tasks.md
  steering/
    product.md          # FrankenMCP 是什么、给谁用
    tech.md             # 技术栈、命令、约定
    structure.md        # 目录结构、模块边界
  hooks/
    typecheck-on-save.json      # 保存 .ts 文件时跑 tsc --noEmit
    schema-snapshot-on-mcp-change.json  # mcp.json 变动时重新生成工具快照 + 跑相关测试
  settings/
    mcp.json            # 预配 notes / tasks / calculator 三个演示服务器
  agents/
    router-orchestrator.json    # 负责路由决策的子 agent 定义
```

**工作方式（重要）**：spec 阶段（requirements → design → tasks）在 Kiro IDE/CLI 里走，由 Kiro 生成并经人确认；Antigravity 按确认后的 `tasks.md` 做实现。不要跳过 Kiro 直接开写——评审问起来要能讲清 spec 是怎么驱动实现的，哪些 hook 真的触发过，PBT 抓到过什么问题。

## 7. 四周计划

- **Week 1（11-06 – 11-12）**：建仓库 + MIT + `/.kiro` 骨架；Kiro 里完成 router-core 的 spec 三件套；路由器依赖接通；3 个演示服务器跑通；Vercel 首次部署（哪怕只有占位页）；实测 Kiro 模型大陆可用性 + YouTube 上传通道（私密视频试传）。
- **Week 2（11-13 – 11-19）**：Playground 对话框 + 路由/裁剪跑通；Monster Lab 仪表盘第一版（真实数字）。
- **Week 3（11-20 – 11-26）**：PBT 三条性质全绿；GitHub 可选服务器；打磨 UI（怪物实验室视觉：暗色 + 实验室绿/紫点缀，别做成普通管理后台）；部署稳定版；写 Devpost 提交草稿。
- **Week 4（11-27 – 12-04）**：录演示视频（<3 分钟，公开 YouTube，展示真机运行）；写 Kiro 用法说明（spec/hooks/steering/MCP/agents/PBT 各讲一个具体故事）；提交；留 2 天 buffer 处理突发问题。

## 8. 提交清单（Devpost，12-04 14:00 PT 前）

- [ ] 公开 GitHub 仓库链接（含 MIT + `/.kiro`）
- [ ] 可运行的应用链接（Vercel，无需登录）
- [ ] <3 分钟公开 YouTube 演示视频
- [ ] Kiro 用法说明：specs、hooks、steering、MCP、agents、PBT 各写一段真实经过
- [ ] 类别：Frankenstein
- [ ] 4,000 credits 已申请（已提交，待 48h 审核 + Didit 身份核查；兑换码 12-04 前兑换）

## 9. 验收标准（Definition of Done）

- 新用户打开 Vercel 链接，不用注册、不用填 key，就能连上 3 个演示服务器、问一句话、看到路由决策和裁剪数字。
- `npm install && npm test && npm run build` 在干净环境一次通过。
- 仓库里没有任何密钥、商业 DRM 代码、或 `/.kiro` 被 ignore 的痕迹。
- README 讲清：这是什么、怎么跑、复用了什么旧组件、Kiro 是怎么用的。
