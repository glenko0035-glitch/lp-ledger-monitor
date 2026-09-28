'use client';
import ledger from './ledger.json';
import snapshot from './snapshot.json';
const sources=[
 {prefix:'5cb234',label:'直接買入',cost:1233.086991},
 {prefix:'6ed3e2',label:'09/11 collect',price:0.5858912368918344},
 {prefix:'1f80a7',label:'09/12 collect',price:0.6015843993689884},
 {prefix:'bdfb06',label:'09/14 collect',price:0.5712418542910269},
 {prefix:'70d339',label:'09/16 collect',price:0.6662386858695102},
 {prefix:'7fb0bb',label:'09/18 collect',price:0.6608333883496449},
 {prefix:'44f67c',label:'09/21 collect',price:0.6371334331964745},
 {prefix:'2cd475',label:'09/26 collect',price:0.6629252570975199},
 {prefix:'d81d14',label:'池三退出回款（含本金）',price:0.6543660801515159},
];
const money=(n:number)=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const qty=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:6});
export default function PonsHolding(){
 const lots=sources.map(s=>{const row=ledger.find(r=>r.hash.startsWith('0x'+s.prefix));return {...s,hash:row?.hash,quantity:row?.token||0,basis:s.cost??(row?.token||0)*(s.price||0)};});
 const before=lots.reduce((n,l)=>n+l.quantity,0),basis=lots.reduce((n,l)=>n+l.basis,0),average=basis/before;
 const opening=ledger.find(r=>r.hash.startsWith('0x4173f161')),deposited=-(opening?.token||0),knownQuantity=before-deposited,knownCost=basis-deposited*average;
 const price=snapshot.pool3.price,wallet=snapshot.totals.breakdown.walletPons,unpriced=wallet-knownQuantity,value=knownQuantity*price,pnl=value-knownCost;
 return <section className="panel" style={{marginBottom:24}}>
  <div className="panel-top"><div><h2>錢包 PONS 持有盈虧</h2><p>買入、collect 與池三退出回款 · 加權平均成本</p></div><span className="badge live">已核對成本批次</span></div>
  <div className="overview-grid"><div><p>持有盈虧（已核對批次）</p><strong className={pnl>=0?'positive':'negative'} style={{fontSize:30}}>{pnl>=0?'+':'−'}{money(Math.abs(pnl))}</strong><p>{(pnl/knownCost*100).toFixed(2)}%</p></div><dl className="stats">
   {[
    ['錢包 PONS 總量',qty(wallet)+' PONS'],['已核對成本數量',qty(knownQuantity)+' PONS'],['平均成本',money(average)+' / PONS（精確值 '+average.toFixed(6)+'）'],['當前池價',price.toFixed(6)+' USDG / PONS'],['剩餘成本',money(knownCost)],['已核對批次當前價值',money(value)],['全部錢包當前價值',money(wallet*price)],
   ].map(([label,v])=><div key={label}><dt>{label}</dt><dd>{v}</dd></div>)}
  </dl></div>
  <p className="footnote">估值時間：{new Date(snapshot.asOf).toLocaleString('zh-TW',{timeZone:'Asia/Shanghai',hour12:false})}（北京時間）。USDG 按 $1；此持有盈虧已包含於整體盈虧，不再次扣除。未包含 Gas。</p>
  <details style={{marginTop:16}}><summary>成本來源與池四轉入明細</summary><dl className="stats">{lots.map(l=><div key={l.prefix}><dt><a href={'https://robinhoodchain.blockscout.com/tx/'+l.hash} target="_blank" rel="noreferrer">{l.label}</a> · {qty(l.quantity)} PONS</dt><dd>{money(l.basis)}</dd></div>)}<div><dt>池四轉入 {qty(deposited)} PONS · 扣除平均成本</dt><dd>−{money(deposited*average)}</dd></div></dl>
   <p>買入按實付 USDG 記成本；collect 和撤池回款按執行前最近一筆 Swap 的鏈上池價估值。池三回款含 LP 本金，並非全部手續費。臨時 LP 的等量往返沿用原成本，池四投入按加權平均成本扣減。</p>
   <p>其餘 {qty(unpriced)} PONS 的原始成本尚未核對，未納入上述盈虧。新增交易若改變這部分差額，需要補入成本批次。</p>
  </details>
 </section>;
}
