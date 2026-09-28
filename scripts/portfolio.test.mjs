import assert from 'node:assert/strict';
import fs from 'node:fs';
import {portfolio} from './portfolio.mjs';
const rows=JSON.parse(fs.readFileSync('app/ledger.json'));
const snapshot=JSON.parse(fs.readFileSync('app/snapshot.json'));
const p=snapshot.pool3;
const other=snapshot.pool4?[snapshot.pool4]:[];
const a=portfolio(rows,p,other),b=portfolio(rows,{...p,price:p.price+0.1},other);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
near(b.value-a.value,(p.pons+p.unclaimedPons+other.reduce((n,p)=>n+p.pons+p.unclaimedPons,0)+a.breakdown.walletPons)*0.1);
near(a.breakdown.walletPons,a.breakdown.independentPons+a.breakdown.lpRelatedWalletPons);
near(a.value,a.breakdown.lpValue+a.breakdown.unclaimedValue+a.breakdown.walletPonsValue+a.breakdown.walletUsdg);
near(a.pnl,a.value-a.external-a.gas);
const tx=rows.find(r=>r.hash.startsWith('0x5cb234'));
assert.equal(tx.category,'investment');
near(tx.token,1739.85248564212);
if(snapshot.pool4){
 assert.equal(snapshot.pool3.liquidity,'0');
 assert.equal(snapshot.pool4.nft,3325756);
 assert.ok(BigInt(snapshot.pool4.liquidity)>0n);
 const temporary=rows.filter(r=>r.category==='temporary-lp');
 assert.equal(temporary.length,2);near(temporary.reduce((n,r)=>n+r.token,0),0);
 assert.ok(temporary.every(r=>r.gasUsd>0));
 assert.equal(rows.filter(r=>r.excludedFromPnl).length,4);
 assert.ok(rows.filter(r=>r.excludedFromPnl).every(r=>r.usd===0&&r.token===0&&r.gasUsd===0));
 near(a.value,portfolio(rows,p).value+snapshot.pool4.pons*p.price+snapshot.pool4.usdg+snapshot.pool4.unclaimedPons*p.price+snapshot.pool4.unclaimedUsdg);
}
// Regression for the exact screenshot snapshot, independent of the latest refresh.
const historical=portfolio(rows,{pons:11005.938882639963,usdg:2605.5730297762,price:0.6272142585047732,unclaimedPons:39.53931382578317,unclaimedUsdg:26.499244});
if(snapshot.asOf==='2026-09-15T06:11:52Z')near(historical.value,11096.815282225799);
console.log('PASS portfolio totals, independent holding, price sensitivity and screenshot regression');
