---
name: cashop
description: Cashop 平台 CLI — 登录、搜索、商品、购物车、订单、售后、AI 对话。通过 `cashop` 子命令直接驱动后台 gateway。
homepage: https://github.com/Cashop-Tech/cashop-cli
metadata:
  {
    "openclaw":
      {
        "emoji": "🛒",
        "requires": { "bins": ["cashop"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "Cashop-Tech/tap/cashop",
              "bins": ["cashop"],
              "label": "Install cashop (brew)",
            },
            {
              "id": "sh",
              "kind": "sh",
              "url": "https://raw.githubusercontent.com/Cashop-Tech/cashop-cli/release/install.sh",
              "bins": ["cashop"],
              "label": "Install cashop (install.sh)",
            },
          ],
      },
  }
---

# cashop

`cashop` 是 Cashop 平台的官方 CLI。**永远**用 flat 子命令 + `--json`，不要在 agent 场景里裸跑 `cashop`（会进 readline TUI，阻塞 stdin）。

## 鉴权（agent 场景强制用 API Key）

- 让用户在 `~/.openclaw/env` 里 `export CASHOP_API_KEY=csk_live_xxx`（或在宿主配置注入 env）
- 10 把上限；创建/删除 key 只能在 OAuth Device 会话里，agent 不要代用户创建 key
- 验证：`cashop whoami --json`

不要引导用户做 `cashop login` / OAuth Device，那个流程要弹浏览器。

## 环境

- 切环境：`cashop env stable` / `cashop env prod`（切完命令即生效）
- 查看当前：`cashop env --json`
- 读取/设置 config：`cashop config`、`cashop config <key>`、`cashop config <key> <value>`

## 只读查询（随便调）

- 搜索：`cashop search "<keyword>" [--page N --page-size N] --json`
- 商品详情：`cashop product <spuCode> --json`
- 尺码：`cashop size <spuCode> --json`
- 推荐：`cashop recommend <spuCode> --json`
- 订单列表：`cashop orders [--page N --page-size N] --json`
- 订单详情：`cashop order <orderNo> --json`
- 物流追踪：`cashop track <orderNo> --json`
- 地址列表：`cashop address list --json`
- 运费对比：`cashop shipping compare --json ...`
- 支付方式/信息：`cashop pay methods --json` / `cashop pay info <paymentTradeNo> --json`

所有命令默认 `--country JP --currency JPY --language ja`；需要别的地区时显式覆盖。

## 写操作（**必须先向用户确认**，不要自行触发）

以下命令会改变用户账户/订单状态，调用前一定要复述参数并等用户明确说"确认/确定/yes"再执行：

- `cashop cart add --spu <x> --sku <y> --qty <n>` — 加购
- `cashop cart split ...` — 购物车拆分
- `cashop checkout split ...` / `cashop checkout fee ...` — 结算预览
- `cashop pay checkout ...` — 发起支付
- `cashop order create ... --business-order-no biz_<hash>` — 下单（`--business-order-no` 必传，幂等键）
- `cashop order cancel <orderGroupNo>` — 取消订单
- `cashop address save ...` — 保存地址
- `cashop refund apply ...` — 申请退款
- `cashop coupon claim ...` — 领券
- `cashop promo ...` — 营销相关

`order create` 默认 `--delivery-type CONSOLIDATION`；`DIRECT_MAIL` 需额外 `--dm-line-code` 和 `--dm-shipping-fee`。

## AI 对话透传（和 openclaw 自己的 chat 功能是两回事）

`cashop ask` 会调 cashop-ai 的 SSE 接口，返回一轮 AI 导购的完整回答——只在用户**明确要调用 cashop 内置 AI 助手**时用，不要拿来替换 openclaw 当前的 agent 回答：

- `cashop ask "推荐一下适合夏天的连衣裙" --json`
- 续上一次：`cashop ask "那 M 码还有吗" --resume --json`
- 指定 session：`cashop ask "..." --session <id> --json`
- 会话管理：`cashop sessions --json`、`cashop session rm <id> -y`

## API Key 管理（只能在 OAuth Device 会话里）

通常用户自己跑，agent 不要代执行；仅做排错辅助：

- `cashop apikey list --json`
- `cashop apikey create --name <n> [--ttl 30d|90d|180d|1y|never] --json`（key 只显示一次）
- `cashop apikey rm <kid> -y --json`

错误码速查：`703012` 达上限；`703013` api-key 不能管 api-key；`703014` 重名；`703015` kid 不存在。

## 输出约定

- 加 `--json` 得到结构化 `{code, msg, data}` —— 直接解 `data`
- 不加 `--json` 是给人看的表格/文本，**不要**让 agent parse
- 非零 exit code = 失败；错误会经 `core/errors.ts` 映射到可读信息
- stderr 可能含诊断信息，正常响应看 stdout

## 常见坑

- 不要 spawn `cashop`（无参）→ 会进 readline TUI，直接 hang
- 不要用 `--resume` 配合没跑过 `cashop ask` 的新机器 → 没有 `last_session_id`
- `~/.cashop/chat.yaml` 只存 `last_session_id`，消息体在服务端；清本地不会丢历史
- 写操作 payload 里的金额/币种要和当前 env 一致；prod 环境下先 `cashop env` 核对
