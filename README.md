# 🐼 实习饲养员 - 动物园模拟游戏

一款基于 **Phaser 3 + TypeScript** 开发的 2D 横版休闲模拟游戏。玩家扮演新入职的实习饲养员，在 8 分钟（真实时间）内按照工作时间表穿梭于 6 个笼舍之间，完成清洁、投喂、温度记录等日常工作。

---

## 🎮 游戏玩法

| 项目 | 说明 |
|------|------|
| 游戏时长 | 8 分钟（真实时间） = 动物园一个工作日（游戏内 8:00 - 16:00） |
| 及格条件 | 动物福利分 **≥ 60 分** |
| 初始分数 | 100 分（做错扣福利分） |
| 笼舍数量 | 6 个（川金丝猴 / 扬子鳄 / 大熊猫 / 东北虎 / 金刚鹦鹉 / 长颈鹿） |
| 任务类型 | 🧹 清洁 · 🍽️ 投喂 · 🌡️ 温度记录 |

### 三种任务操作

1. **🧹 清洁**：在面板内点击 3 处不规则污渍即可完成。
2. **🍽️ 投喂**：从食盘中拖拽正确的食物到食槽中，需遵守每个动物的特殊规则。
3. **🌡️ 记录**：使用 `+ / −` 按钮调整温度计到目标温度（有容差），点击确认。

### 移动方式
- `← →` 方向键或 `A / D` 键移动角色
- 点击左右屏幕边缘快速跳转
- 点击右上角小地图的动物头像直接传送

---

## 📦 安装与运行

### 方式一：开发模式（推荐本地开发）

```bash
# 安装依赖
npm install

# 启动 Vite 开发服务器（默认 http://localhost:8080）
npm run dev
```

### 方式二：生产构建 + Nginx 静态服务器

```bash
# 1. 构建生产产物（输出到 dist/）
npm install
npm run build

# 2. 使用 docker-compose 启动 Nginx（端口 8080）
docker-compose up -d

# 3. 浏览器访问 http://localhost:8080
```

### 方式三：仅使用 Docker 构建并运行

```bash
docker build -t zoo-keeper-game .
docker run -p 8080:80 zoo-keeper-game
```

---

## 🏗️ 项目结构

```
tl-0029-1/
├── src/
│   ├── main.ts                  # Phaser 游戏入口 & 配置
│   ├── types/
│   │   └── index.ts             # TypeScript 类型定义（含食物枚举）
│   └── scenes/
│       ├── BootScene.ts         # 资源加载 + 启动页
│       ├── MenuScene.ts         # 主菜单（含操作说明）
│       ├── GameScene.ts         # 核心游戏场景（玩家/笼舍/任务/HUD）
│       └── ResultScene.ts       # 结算场景（耗时/失误列表/数据统计）
├── public/
│   └── levels/
│       └── level1.json          # 第一关配置文件
├── index.html                   # HTML 入口
├── package.json
├── tsconfig.json
├── vite.config.ts
├── docker-compose.yml           # Nginx 静态托管
├── nginx.conf                   # Nginx 配置（含 gzip / 缓存）
├── Dockerfile                   # 多阶段构建镜像
└── README.md
```

---

## 🧩 关卡配置 JSON 格式

所有关卡数据位于 `public/levels/*.json`，游戏启动时由 `BootScene` 预加载。配置分为 **元数据、笼舍、时间表、提示卡** 四大部分。

### 顶层结构

```jsonc
{
  "id": "level_1",                       // 关卡唯一ID
  "name": "第一关：实习上岗日",           // 显示名称
  "description": "欢迎来到珍奇动物园...", // 主菜单描述
  "gameDurationMinutes": 8,              // 真实游戏时长（分钟）
  "realTimeMultiplier": 60,              // 时间流速：1真实秒 = 60游戏秒
  "startHour": 8,                        // 游戏起始时间（小时，如8=08:00）
  "minWelfareScore": 60,                 // 及格福利分
  "cages": [ /* 笼舍数组 */ ],
  "schedule": [ /* 任务时间表 */ ],
  "hintCards": [ /* 提示卡片 */ ]
}
```

### `cages[]` — 笼舍配置

```jsonc
{
  "id": "cage_monkey",              // 唯一ID（关联 schedule）
  "name": "1号笼舍",                // 显示名
  "animalName": "川金丝猴",          // 动物名
  "animalEmoji": "🐒",              // 动物图标（Emoji）
  "color": 16766720,                // 笼舍主体色（十进制 0xFFD700 = 16766720）
  "accentColor": 12829635,          // 笼舍边框/屋顶色
  "position": { "x": 150, "y": 400 },  // 横版世界坐标
  "acceptedFoods": ["fresh_fruit", "nuts", "leaves"],  // 可接受食物白名单
  "specialHint": "川金丝猴拒食隔夜水果，会严重影响健康！",  // 任务面板警告
  "rules": [
    {
      "description": "禁止投喂隔夜水果",
      "check": {                      // 规则检查器（见下）
        "foodId_not": "overnight_fruit"
      },
      "penalty": 15,                  // 违反扣分
      "penaltyReason": "给川金丝猴投喂了隔夜水果！"  // 失误列表文案
    }
  ]
}
```

### 规则检查器 `rules[].check`

支持的字段组合（**所有条件同时满足时视为违规，触发扣分**）：

| 字段 | 值类型 | 含义 |
|------|--------|------|
| `foodId_eq` | `FoodType` | 投喂的食物 **等于** 该值时违规 |
| `foodId_not` | `FoodType` | 投喂的食物 **不等于** 该值时违规（常用于禁止） |
| `foodId_in` | `FoodType[]` | 投喂的食物 **不在** 数组中时违规 |
| `timeOfDay_eq` | `"morning"` \| `"afternoon"` | **上午(8-12)/下午(12-16)** 限定（配合食物规则使用） |

**示例**：扬子鳄「下午必须喂活鱼，上午必须喂切块肉」—— 写两条规则：

```json
"rules": [
  { "check": { "timeOfDay_eq": "afternoon",  "foodId_eq": "live_fish" }, "penalty": 12, "penaltyReason": "..." },
  { "check": { "timeOfDay_eq": "morning",    "foodId_eq": "meat" },      "penalty": 12, "penaltyReason": "..." }
]
```

### `schedule[]` — 任务时间表

```jsonc
{
  "id": "t1",                          // 唯一ID
  "cageId": "cage_monkey",             // 关联笼舍ID
  "taskType": "clean" | "feed" | "record",  // 任务类型
  "scheduledTime": 8.2,                // 预定时间（小时，8.2 = 08:12）
  "windowMinutes": 60,                 // 可执行时间窗口（分钟），超时未做扣分
  // 当 taskType = "feed" 时必填：
  "foodId": "fresh_fruit",             // 推荐投喂的食物
  // 当 taskType = "record" 时必填：
  "targetTemperature": 26,             // 目标温度
  "temperatureTolerance": 2            // 容差（±℃）
}
```

### 食物类型 `FoodType` 枚举

在 `src/types/index.ts` 中定义，可自行扩展：

| ID | 名称 | 颜色 | 形状 | 说明 |
|----|------|------|------|------|
| `fresh_fruit` | 新鲜水果 | 0xff6b6b | circle | 🔴 |
| `overnight_fruit` | 隔夜水果 | 0x8b7355 | circle | ⚫ 川金丝猴禁食 |
| `bamboo` | 新鲜竹子 | 0x4ecdc4 | rect | 🟩 大熊猫主食 |
| `meat` | 切块肉 | 0xc44569 | triangle | 🔺 上午投喂扬子鳄 |
| `live_fish` | 活鱼 | 0x54a0ff | rect | 🟦 下午投喂扬子鳄 |
| `nuts` | 坚果 | 0xa0522d | circle | 🟤 |
| `leaves` | 嫩叶 | 0x6ab04c | triangle | 🔺 长颈鹿主食 |

### `hintCards[]` — 提示卡片

字符串数组，游戏开始后每 6.5 秒从左向右依次弹出，滚动显示：

```json
"hintCards": [
  "🐒 川金丝猴：绝不能喂隔夜水果！只能喂新鲜水果、坚果或嫩叶",
  "🐊 扬子鳄：上午(8-12点)喂切块肉，下午(12-16点)喂活鱼",
  "⏰ 关注时间表：错过任务时间窗口也会扣分！"
]
```

---

## 🎯 计分规则

| 事件 | 扣分值 |
|------|--------|
| 投喂食物违反动物规则（如隔夜水果给猴子） | 6 ~ 15 |
| 记录温度超出容差 ≤2x 容差 | 6 |
| 记录温度超出容差 >2x 容差 | 12 |
| 错过任务时间窗口 1.5x | 8 |
| 福利分 **< 60** 立即终止并判负 | — |

**结算页展示**：耗时、完成任务数、任务完成率、失误列表（含时间/笼舍/原因/扣分）。

---

## 🛠️ 自定义扩展

- **新增笼舍**：在 JSON `cages` 中新增一项，并设置世界坐标（`x` 建议 ≥ 60 间距）。
- **新增任务**：在 `schedule` 中追加，注意 `taskType` 对应字段（feed 需要 `foodId`，record 需要温度字段）。
- **新增食物**：在 `src/types/index.ts` 的 `FOODS` 数组中添加，然后在笼舍 `acceptedFoods` 中引用。
- **新增规则类型**：在 `GameScene.ts` 的 `validateFeedChoice` 方法中扩展 `check` 字段解析逻辑。

---

## 🧪 技术栈

| 类别 | 选型 |
|------|------|
| 游戏引擎 | Phaser 3.70 |
| 语言 | TypeScript 5.3 (strict) |
| 构建工具 | Vite 5 |
| 静态托管 | Nginx Alpine + Docker Compose |
