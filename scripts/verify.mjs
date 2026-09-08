import assert from 'node:assert/strict';import fs from 'node:fs';
const l=JSON.parse(fs.readFileSync('app/ledger.json')),s=JSON.parse(fs.readFileSync('app/snapshot.json'));
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
assert.equal(new Set(l.map(x=>x.hash)).size,l.length);
near(l.filter(x=>x.pool===0).reduce((n,x)=>n+x.usd,0),11325.242392);
near(l.filter(x=>x.pool===0).reduce((n,x)=>n+x.originalUsdt,0),11334.61);
near(l.filter(x=>x.pool===0).reduce((n,x)=>n+x.cexCost,0),9.367608);
assert.ok(l.filter(x=>x.pool===0).every(x=>!x.gasPaidByWallet&&x.gasUsd===0));
near(s.totals.value-s.totals.external-s.totals.gas,s.totals.pnl,1e-4);
near(s.pool3.value-s.pool3.capital-s.pool3.gas,s.pool3.pnl);
near(s.pool3.value,(s.pool3.pons+s.pool3.walletPons+s.pool3.unclaimedPons)*s.pool3.price+s.pool3.usdg+s.pool3.walletUsdg+s.pool3.unclaimedUsdg);
assert.ok(l.every(x=>x.gasEth>=0&&Number.isFinite(x.gasEth)));
if(s.apr.value!==null){assert.ok(s.apr.volume24h!==null&&s.apr.tvl>0)}
console.log('PASS: transaction deduplication, funding, cost attribution, position valuation and portfolio reconciliation');
