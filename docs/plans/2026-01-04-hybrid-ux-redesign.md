# AgentDeck "Living Blueprint" UX Redesign

> 设计日期：2026-01-04
> 状态：提案（修订版）
> 核心范式：鲜活蓝图 (The Living Blueprint)

## 1. 核心理念与变革

### 1.1 核心问题
之前的“表单 -> 运行”模式割裂了**构建**与**使用**。在 Agent 时代，构建即使用，通过对话不断迭代（Prompt Engineering / Skill Execution）才是常态。

### 1.2 "Living Blueprint" 范式
本项目将融合三种交互模式，打造一个有生命力的工作台：
1.  **Immersive Tuner (沉浸调优)**：左右分屏，左侧配置，右侧运行，修改即生效。
2.  **Meta-Builder (自然构建)**：用自然语言生成初始配置，消除冷启动门槛。
3.  **Evolutionary (即时进化)**：在运行中根据需求动态挂载工具，无需中断。

---

## 2. 信息架构与布局

### 2.1 全局视口 (Split Viewport)
页面不再分为 Create Page 和 Run Page，而是统一为一个**工作台 (Workbench)**。

*   **Left Panel (Blueprint / 蓝图)**
    *   承载 Agent 的“灵魂”与“能力”。
    *   核心组件：Config Header, Prompt Editor, Skills Rack (Tools/Sub-Agents)。
    *   视觉隐喻：工程图纸、草稿、可编辑状态。
*   **Right Panel (Stage / 舞台)**
    *   承载 Agent 的“表现”与“交互”。
    *   核心组件：Chat Stream, Live Logs (底部折叠), Suggestion Layer。
    *   视觉隐喻：最终成品、打印纸、交互状态。

---

## 3. 详细交互流程

### 3.1 阶段一：创世纪 (Genesis)
**场景**：用户进入新 Agent 页面。

*   **初始状态**：
    *   Left Panel: 空白或仅显示骨架（半透明）。
    *   Right Panel: 显示“架构师 (Architect)”欢迎语。
*   **交互**：
    *   Run: 用户在右侧输入 *"给我做一个能每日抓取 HackerNews 并写摘要的 Agent"*。
    *   Action: 架构师分析意图，**流式填充**左侧面板。
        *   Prompt Editor 自动填入 System Prompt。
        *   Skills Rack 自动挂载 `BrowserTool`, `ScheduleTool`。
    *   Transition: 填充完成后，系统自动 Launch 容器。右侧对话框“变形”为新 Agent 的运行窗口。

### 3.2 阶段二：协同调优 (Co-Tuning)
**场景**：用户觉得 Agent 回答不够专业。

*   **交互**：
    *   Run: 用户在左侧 Prompt Editor 修改文案，从 "You are a helper" 改为 "You are a senior tech editor"。
    *   Action: 用户按 `Cmd+Enter` 或点击 "Apply"。
    *   Feedback:
        *   右侧 Chat 顶部出现微小的 "Reloading..." 状态条（保留历史记录）。
        *   后端容器快速重启（~2s）。
        *   Agent 发送 "Config Updated" 系统消息。
    *   Run: 用户点击上一条消息旁的 "Retry" 按钮，Agent 用新设定重新回答。

### 3.3 阶段三：动态进化 (Evolution)
**场景**：Agent 发现自己缺少工具。

*   **交互**：
    *   Run: 用户问 *"分析一下 google 股价"*。
    *   Agent (LLM): *"抱歉，我无法联网。"*
    *   Action: 系统层（System Monitor）捕获到意图或错误。
    *   Suggestion: 右侧 Chat 流中插入一张卡片 *"建议：检测到搜索意图，是否添加 `GoogleSearch` 工具？"*
    *   Run: 用户点击 "Add Tool"。
    *   Visual: 工具通过动画从右侧卡片飞入左侧 Skills Rack。
    *   Auto-Repair: 系统自动重启 Agent 并重新执行 *"分析一下 google 股价"*。

---

## 4. 关键组件规格

### 4.1 Left Panel: The Blueprint
*   **Prompt Editor**
    *   支持 Markdown 高亮。
    *   自动伸缩高度。
    *   Diff Indicator: 修改后显示“未保存”状态（小黄点）。
*   **Skills Rack (能力架)**
    *   表现为一组 **Tags** 或 **Chips**。
    *   支持拖拽排序（Drag & Drop）。
    *   "Add" 按钮唤起一个 **Command Palette (Cmd+K)** 风格的搜索框，而不是全屏弹窗。

### 4.2 Right Panel: The Stage
*   **Unified Chat Stream**
    *   混合显示三种消息：
        1.  User Message (右侧气泡)
        2.  Agent Message (左侧气泡，Markdown 渲染)
        3.  **System/Meta Message** (居中，低对比度，用于显示 "Tool Added", "Restarted", "Suggestion")。
*   **Input Area**
    *   普通的 Chat Input。
    *   支持 Slash Commands (`/config` 可聚焦左侧，`/restart` 强制重启)。

---

## 5. 视觉风格 (Visual Language)

### 5.1 隐喻：Idea to Reality
*   **左侧 (Drafting)**
    *   背景色：`#FAF9F6` (Off-white / Paper)
    *   字体：`IBM Plex Mono` (等宽，技术感)
    *   强调色：`#6B645C` (铅笔灰)
*   **右侧 (Reality)**
    *   背景色：`#FFFFFF` (Pure White)
    *   字体：`Space Grotesk` (现代无衬线，清晰)
    *   强调色：`#2E3A4A` (深蓝墨)

### 5.2 动效 (Motion)
*   **Morphing**: 架构师模式 -> 运行模式的平滑过渡。
*   **Flying Elements**: 工具从建议卡片飞入配置栏的动画，强化“装配”感。
*   **Optimistic Updates**: 点击 Apply 后立即给出视觉响应，掩盖 Docker 重启的延迟。

---

## 6. 技术实现路径

### 6.1 前端状态机
需要维护一个复杂的 **Session State**：
*   `DRAFT` (仅左侧有数据)
*   `LAUNCHING` (Docker 启动中)
*   `RUNNING` (双向交互)
*   `RELOADING` (保留右侧历史，阻断输入，等待左侧生效)

### 6.2 后端适配
*   利用现有的 `POST /launch` 和 `POST /stop`。
*   新增（或模拟）`PATCH /config`：实际上是 `Stop -> Update DB -> Launch` 的组合拳，但在 UX 上封装为单一动作。

---

## 7. 成功指标

*   **TTHW (Time to Hello World)**: < 10秒 (通过 Meta-Builder 实现)。
*   **Iteration Speed**: 修改 Prompt 到验证效果的时间 < 5秒。
*   **Discovery Rate**: 用户通过 Suggestion 添加工具的次数提升。
