export const pool4Config={poolId:'0x486435a1f76cd58193f854c6e6213cd05fd58d637865d02065ff558b387fa6ea',lower:-284160,upper:-277980,nft:3325756};
export function pool4Accounting(position,rows){
 const opening=rows.find(r=>r.hash.startsWith('0x4173f161'));
 const sqrt=1.0001**(pool4Config.lower/2)+(-opening.usd)*1e6/25927425798322537;
 const entryPrice=sqrt*sqrt*1e12,capital=-opening.usd-opening.token*entryPrice;
 const gas=rows.filter(r=>r.pool===4).reduce((n,r)=>n+r.gasUsd,0);
 const value=(position.pons+position.unclaimedPons)*position.price+position.usdg+position.unclaimedUsdg;
 return {...position,...pool4Config,active:position.liquidity!=='0',entryPrice,capital,gas,value,pnl:value-capital-gas,roi:(value-capital-gas)/(capital+gas)*100};
}
const ignored=['920c5fc','d17dd4ef','5fce25db','e2cd46e7'];
export function correctTransactions(rows){
 for(const row of rows){
  const prefix=row.hash.slice(2);
  if(ignored.some(p=>prefix.startsWith(p))){if(row.usd!==0||row.token!==0||row.gasPaidByWallet)throw Error('Excluded transaction has wallet cashflow');Object.assign(row,{category:'excluded',action:'無關代幣記錄／不計盈虧',recognized:true,excludedFromPnl:true});}
  if(prefix.startsWith('5cb234'))Object.assign(row,{category:'investment',pool:5,action:'買入 PONS／獨立投資',recognized:true});
  if(prefix.startsWith('d81d1487'))Object.assign(row,{category:'lp',pool:3,action:'關閉池三／撤出全部流動性',recognized:true});
  if(prefix.startsWith('9bb8df16'))Object.assign(row,{category:'temporary-lp',pool:6,action:'臨時 LP 開倉 #3325305',recognized:true});
  if(prefix.startsWith('5121a97e'))Object.assign(row,{category:'temporary-lp',pool:6,action:'臨時 LP 撤出 #3325305',recognized:true});
  if(prefix.startsWith('4173f161'))Object.assign(row,{category:'lp',pool:4,action:'開啟池四 #3325756',recognized:true});
 }
 return rows;
}
