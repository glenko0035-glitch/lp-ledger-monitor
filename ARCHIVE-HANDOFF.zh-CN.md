# LP Observatory 归档交接

更新日期：2026-09-15（Asia/Shanghai）

## 线上入口

- 主站（Cloudflare Worker）：https://lp-ledger-monitor.daily-signal-glen.workers.dev/
- 生态数据页：https://lp-ledger-monitor.daily-signal-glen.workers.dev/ecosystem
- GitHub：https://github.com/glenko0035-glitch/lp-ledger-monitor
- GitHub Actions：仓库中的 `Refresh LP monitor` 工作流

旧的 `glen2212.chatgpt.site` 地址属于早期 Sites 版本，不作为当前部署入口。

## 自动更新

GitHub Actions 每小时唤醒一次，但只有在快照超过约 8 小时或首次运行时才真正抓取钱包链上数据；因此正常钱包数据更新时间为北京时间约 01:17、09:17、17:17。Uniswap 市场数据和生态 Dune 缓存也按约 8 小时的有效期刷新。

这不是严格准点任务：GitHub Actions 排队、失败或 RPC 限流都会造成延迟。页面的“超过 10 小时”提示只表示当前快照陈旧，不会自行修复数据。

## 必需配置

在 GitHub 仓库 Settings → Secrets and variables → Actions 中维护以下 Secret 名称：

- `ROBINHOOD_RPC_URL`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `DUNE_API_KEY`

只保存 Secret 名称和用途，不把值写入代码、文档或提交记录。

## 日常维护

1. 先查看 Actions 最近一次运行及失败步骤。
2. 手动运行 `Refresh LP monitor` 进行一次更新。
3. 若需本地核验：`node scripts/refresh.mjs` → `node scripts/verify.mjs` → `npm run build`。
4. RPC 返回 429 时不要并行重跑；等待退避后再运行，必要时检查 RPC 服务商配额。
5. Dune 查询使用已有结果缓存，不会每次运行重新执行查询；数据源失败时保留上次成功结果并记录错误。

## 资产与收益口径

当前总策略资产由账本余额重建，包含：

`LP 仓位价值 + 未领取手续费价值 + 账本中与 LP 相关的 PONS + 独立 swap 持仓 PONS + 账本 USDG`

总收益为：

`当前策略资产 - 外部本金 - 钱包实际 gas`

外部本金为原始入金 11,334.61 USDG/USDT 等值；CEX 前置费用 9.367608 已包含在原始成本关系中，不再重复扣除。独立 swap `0x5cb234…d3ba90e7` 是未加入 LP 的持仓，必须保留在总资产中；`0x078ae0…d281cb` 已按加入池三处理。

池一、池二的历史结算保留在账本中；池三的单池贡献仍是归因估算，不能与总策略资产简单相加。固定的“历史基数”已从总公式移除。

## 已知限制

- 钱包账本是根据已验证收据、事件和增量扫描重建，不等同于对所有内部交易的完整索引。
- 新的未知 swap、转账或新池子需要先解码并加入分类规则，不能自动假定属于池三。
- Uniswap 官方 APR 在数据不足时显示为空；不得用 0 或估算值冒充官方 APR。奖励未计入。
- Dune 各查询的统计口径不同，尤其是 Pons 日交易量与 Launchpad 交易量不能混用；缺失值不会自动补零。
- 浮点数仅用于展示估值，链上手续费增长等核心计算使用整数精度。

## 稳定版本与继续开发

归档时使用 Git 标签 `v1.0.0-archive` 作为当前产品基线。新需求从 `main` 继续，维护性修复应保留验证脚本和数据来源说明。

给后续维护者的启动语句：

> 继续维护 LP Observatory。先检查 GitHub Actions 最近运行、生产 Worker 和快照时间，再阅读 `ARCHIVE-HANDOFF.zh-CN.md`、`MONITORING.md` 与 `POOL-MONITOR-PRD.md`。保持现有资产口径，不删除历史账本，不把估算 APR 当官方 APR；任何公式变更先补验证脚本，再部署。
