# Agent Creation UX Redesign

> 设计日期：2026-01-04
> 状态：提案

## 1. 背景与问题

### 1.1 用户痛点
- 创建 agent 时被迫面对大量高级配置，信息噪音高。
- Tools/Sub-Agents/Skills/Commands 默认为必经流程，实际多数场景并不需要。
- 创建、运行、对话、日志混在同一屏，任务语义冲突。
- 缺少清晰的“创建完成”定义，导致操作反复与中断。

### 1.2 设计目标
- 新手：一步步创建，知道何时可启动。
- 老手：3 个字段即可完成创建并启动。
- 系统：可选能力后置，降低默认认知负担。
- 结构：创建与运行解耦，避免任务切换干扰。

### 1.3 非目标
- 不改变现有后端数据结构与运行逻辑。
- 不新增复杂模板市场或权限系统。

---

## 2. 核心策略（混合模式）

### 2.1 双入口
- 快速创建（推荐）：最短路径，3 个必填字段。
- 向导创建（新手）：按步骤引导，可随时跳过可选模块。

### 2.2 可选能力后置
- Tools/Sub-Agents/Skills/Commands 以卡片形式出现，默认收起。
- 每个模块明确“可稍后配置”。

### 2.3 视图分离
- Create View 专注创建与配置。
- Run View 专注运行、对话、日志。
- 创建完成后自动切换至 Run View。

---

## 3. 信息架构

### 3.1 Create View
1) 顶部主入口：Create Agent
2) 主体：快速创建卡片 + 向导入口
3) 可选能力区（折叠）
4) 高级配置区（折叠）

### 3.2 Run View
1) 运行状态条（Agent 名称、状态、停止/配置按钮）
2) Conversation 面板
3) Live Logs 面板

---

## 4. 创建流程

### 4.1 快速创建流程
- 输入 Config ID（实时校验 + 自动建议）
- 输入 Display Name
- 选择 Prompt 模板（默认 Claude Base）
- 点击“创建并启动”或“仅创建”
- 进入 Run View

### 4.2 向导创建流程
Step 1: 基础信息
Step 2: 模块选择（Tools/Sub-Agents/Skills/Commands 可选）
Step 3: 模块配置（仅对已启用模块展开）
Step 4: 复核与启动

可在任一步点击“稍后配置”直接跳到复核。

---

## 5. 关键组件规格

### 5.0 Create View 布局网格
- 桌面：12 栅格，双列结构。
  - 左列（7/12）：快速创建卡片。
  - 右列（5/12）：向导入口卡片。
  - 次级区：可选能力模块占满 12/12。
  - 高级配置折叠区占满 12/12。
- 移动：单列堆叠，顺序为快速创建 → 向导入口 → 可选能力 → 高级配置。
- 纵向间距：区块之间 24-32px。
- 卡片内边距：24px（移动端 16px）。

### 5.1 快速创建卡片
- 字段：Config ID / Display Name / Prompt Template
- 操作：创建并启动 / 仅创建
- 校验：Config ID 合法性 + 唯一性提示

### 5.2 模块卡片（可选能力）
- 标题 + 一句话价值说明
- 状态：未启用 / 已启用 / 配置完成
- 按钮：启用 / 暂不 / 配置

### 5.3 高级配置折叠区
- 权限模式、模型、文件与配置、验证
- 默认折叠，仅在需要时展开

### 5.4 Run View 状态条
- 状态：Running / Stopped / Error
- 操作：Start / Stop / Configure

---

## 6. 文案与提示

### 6.1 顶部提示
- “多数 Agent 只需 3 个字段即可启动”

### 6.2 模块卡片说明
- Tools: “让 Agent 可调用外部工具”
- Sub-Agents: “让 Agent 能分工协作”
- Skills: “让 Agent 具备专用知识”
- Commands: “自定义快捷指令”

### 6.3 校验提示
- Config ID 不合法时：提供可用示例（如 code-assistant-1）
- Prompt 模板提示：标注“推荐/默认”

---

## 7. 视觉层级与版式（创作工作台感）

### 7.1 字体与层级
- 标题：中性无衬线（SemiBold），强调清晰与温和。
- 正文：常规字重，字高略宽松，提升可读性。
- 重要操作按钮使用更强对比与更大尺寸。

### 7.2 间距与密度
- 卡片间距：24-32px，保持呼吸感。
- 表单字段行距：12-16px，减少拥挤。
- 分区标题与内容之间留 12-20px。

### 7.3 色彩与引导
- 主色：柔和的蓝绿或暖灰（避免冷硬与警示感）。
- 强调：用于“创建并启动”的单一强调色。
- 可选能力卡片使用浅底色与轻边框区分层级。

### 7.4 交互状态
- 未启用模块：低对比度卡片 + “可稍后配置”提示。
- 已启用模块：提升对比度并显示“已配置/未配置”标签。
- 错误提示：柔和红色 + 具体可执行建议。

---

## 8. 轻量风格板（高级感纸质）

### 8.1 色彩
- 背景：米白（#F7F3EC）
- 面板：浅暖灰（#EEE7DD）
- 文字主色：深墨（#2B2A29）
- 文字次级：灰褐（#6B645C）
- 强调色：深墨蓝（#2E3A4A）
- 成功/提示：柔和绿（#8BAA9B）
- 警示：柔和砖红（#C57966）

### 8.2 字体建议
- 标题：高质量无衬线，字重 600。
- 正文：中性无衬线，字重 400-500。
- 数字/状态：等宽或半等宽变体可选。

### 8.3 组件基调
- 卡片：浅色底 + 细边框，圆角 12px。
- 按钮：主按钮深色底，次按钮描边。
- 输入框：浅底色 + 轻描边，聚焦时描边加深。

---

## 9. UI 规格表（设计系统命名 + CSS 映射）

### 9.1 颜色 Tokens
**Design Tokens**
- surface/base: #F7F3EC
- surface/panel: #EEE7DD
- surface/raised: #FFFFFF
- text/primary: #2B2A29
- text/secondary: #6B645C
- text/tertiary: #8C857E
- accent/primary: #2E3A4A
- accent/hover: #394859
- success: #8BAA9B
- warning: #C57966
- border/subtle: #D8CFC2

**CSS Variables**
```css
:root {
  --surface-base: #F7F3EC;
  --surface-panel: #EEE7DD;
  --surface-raised: #FFFFFF;
  --text-primary: #2B2A29;
  --text-secondary: #6B645C;
  --text-tertiary: #8C857E;
  --accent-primary: #2E3A4A;
  --accent-hover: #394859;
  --success: #8BAA9B;
  --warning: #C57966;
  --border-subtle: #D8CFC2;
}
```

### 9.2 Typography Tokens
**Design Tokens**
- font/title: 24-32px, 600
- font/section: 18-20px, 600
- font/body: 14-16px, 400-500
- font/meta: 12-13px, 400

**CSS Variables**
```css
:root {
  --font-title-size: 28px;
  --font-title-weight: 600;
  --font-section-size: 18px;
  --font-section-weight: 600;
  --font-body-size: 15px;
  --font-body-weight: 400;
  --font-meta-size: 12px;
  --font-meta-weight: 400;
}
```

### 9.3 Spacing + Radius
**Design Tokens**
- space/2: 8px
- space/3: 12px
- space/4: 16px
- space/6: 24px
- space/8: 32px
- radius/card: 12px
- radius/input: 10px

**CSS Variables**
```css
:root {
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --radius-card: 12px;
  --radius-input: 10px;
}
```

### 9.4 Component States
**Buttons**
- Primary: background `accent/primary`, text `surface/raised`, hover `accent/hover`
- Secondary: border `border/subtle`, text `text/primary`, hover `surface/panel`

**Inputs**
- Default: background `surface/raised`, border `border/subtle`
- Focus: border `accent/primary`, shadow subtle
- Error: border `warning`, helper text `warning`

**Cards**
- Default: background `surface/panel`, border `border/subtle`
- Active: border `accent/primary`, shadow light
- Disabled: opacity 0.6

---

## 10. 交互与状态

- Create View 中不展示对话与日志，避免分心。
- 只有在 Agent 已启动时才允许对话输入。
- 可选能力在未启用时不显示内部配置表单。
- 配置完成度以“已配置/未配置”标签体现。

---

## 11. 成功指标

- 创建完成时间下降（目标：-40%）
- 创建放弃率下降（目标：-30%）
- 新手首次成功启动率提升（目标：+25%）

---

## 12. 风险与缓解

- 风险：用户错过高级配置，导致运行异常
  - 缓解：运行前复核页提示“高级配置未设置”
- 风险：向导过长
  - 缓解：模块选择页前置，支持快速跳过

---

## 13. 后续落地建议

- 先改信息架构与流程，后改视觉语言。
- 保留当前配置结构，先做折叠/分层。
- 在 Run View 增加“Configure”入口保持可达性。

---
## 14. 组件清单与优先级

### 11.1 创建视图组件（P0 必做）
- Create Agent 入口按钮（主导航右侧）
- 快速创建卡片（3 字段 + 2 按钮）
- Config ID 实时校验与建议生成
- 向导入口卡片（仅入口，不含内部流程）
- 可选能力卡片组（Tools/Sub-Agents/Skills/Commands）
- 高级配置折叠区（权限/模型/文件/配置/验证）
- 视图切换逻辑（创建完成 → Run View）

### 11.2 向导内部组件（P1 建议）
- 步骤条（基础信息 / 模块选择 / 配置 / 复核）
- 模块选择卡片（启用/暂不/稍后）
- 复核页（未配置提示 + 一键跳过）

### 11.3 运行视图组件（P0 必做）
- 运行状态条（Running/Stopped/Error）
- Conversation 面板
- Live Logs 面板
- Configure 返回入口

### 11.4 统一视觉元素（P0 必做）
- 卡片标题层级（H2/H3）
- 价值说明副标题
- 折叠区标题 + 指示箭头
