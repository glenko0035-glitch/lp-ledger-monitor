# PONS/USDG 整池監控：實施狀態與計算口徑

更新：2026-09-09。每8小時一個UTC固定窗口，對應北京00、08、16時。同窗口重試替換該窗口快照；歷史無期限保留。只讀，個人賬本另存。

## 已接入

前端官方 GraphQL：https://interface.gateway.uniswap.org/v1/graphql 。按 poolId 與 ROBINHOOD 查詢 v4Pool。保存完整來源回應、採集時間及欄位級錯誤。它是前端接口，非有穩定契約的開發者公開API。

| 指標 | 來源/公式 |
|---|---|
| 官方接口TVL | totalLiquidity.value |
| 代幣數量 | token0Supply/token1Supply；不可聲稱等同pool_info儲備 |
| 美元價格 | token0/token1.market(currency:USD).price.value |
| 数量估算TVL | token0Supply×token0美元價格＋token1Supply×token1美元價格 |
| LP費率 | 鏈上PoolManager slot0.lpFee，除以1,000,000 |
| 24H成交量 | cumulativeVolume(duration:DAY).value；目前來源返回ExternalAPIError |
| 費用估算 | 固定池：成交量×已核對LP費率；動態費率不估算 |
| 費用APR百分數 | 費用估算÷官方接口TVL×365×100 |
| 理論APY百分數 | expm1(365×log1p(APR百分數÷100÷365))×100 |

APY假設收益率全年不變且每日複投，不含價格損益或個人成本。不是官方Total APR。固定LP費率為LP費率，不再機械乘協議費折扣；這是成交量近似法，非逐筆實際費用結算。

## 未完成/依賴

- pool_info尚未配置UNISWAP_API_KEY，也未實施已驗證的請求映射；目前使用GraphQL作為替代，不能稱已取得其儲備。
- 24H成交量及歷史成交量目前報錯，LP費用/APR/APY缺失。
- 官方Total APR沒有直接返回欄位；不以估算APR冒充。
- Swap全量索引備援尚未實施；需獨立索引及完整24H覆蓋，不能用少量交易外推。
- 雲端獨立定時器尚未部署；現有排程依賴Codex與本機。

## 監控與顯示

先執行pool-refresh，再執行錢包更新；後者失敗不抹掉整池快照。RPC每次至少間隔1.2秒，429退避10秒、20秒並尊重Retry-After；等待超過60秒交由下次排程。429不拆分區塊範圍。

成功欄位可以顯示，缺失不填零。來源整體失敗保留上次成功快照並記錄錯誤。10小時後顯示過期。兩種TVL差異絕對值超2%提示核對。時間篩選24H/7天/30天/全部；單樣本顯示點，不編造歷史。24H費用窗口相互重疊，不能加總快照值。

## 驗收

已驗證指定池、代幣順序與精度、TVL及價格採集、鏈上LP費率、歷史存儲、空值顯示、個人賬本不變。官方Total APR、pool_info儲備及費用完整鏈路仍待上述來源問題解決，不能標記全量驗收通過。
