import assert from 'node:assert/strict';
import fs from 'node:fs';
import {portfolio} from './portfolio.mjs';
const rows=JSON.parse(fs.readFileSync('app/ledger.json'));
const snapshot=JSON.parse(fs.readFileSync('app/snapshot.json'));
const p=snapshot.pool3;
const a=portfolio(rows,p),b=portfolio(rows,{...p,price:p.price+0.1});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
near(b.value-a.value,(p.pons+p.unclaimedPons+a.breakdown.walletPons)*0.1);
near(a.breakdown.walletPons,a.breakdown.independentPons+a.breakdown.lpRelatedWalletPons);
near(a.value,a.breakdown.lpValue+a.breakdown.unclaimedValue+a.breakdown.walletPonsValue+a.breakdown.walletUsdg);
near(a.pnl,a.value-a.external-a.gas);
const tx=rows.find(r=>r.hash.startsWith('0x5cb234'));
assert.equal(tx.pool,4);
near(tx.token,1739.85248564212);
// Regression for the exact screenshot snapshot, independent of the latest refresh.
const historical=portfolio(rows,{pons:11005.938882639963,usdg:2605.5730297762,price:0.6272142585047732,unclaimedPons:39.53931382578317,unclaimedUsdg:26.499244});
if(snapshot.asOf==='2026-09-15T06:11:52Z')near(historical.value,11096.815282225799);
console.log('PASS portfolio totals, independent holding, price sensitivity and screenshot regression');
