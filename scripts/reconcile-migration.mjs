import fs from 'node:fs';
import {rpc,state,hex,words,MANAGER} from './chain.mjs';
import {correctTransactions,pool4Config,pool4Accounting} from './transaction-corrections.mjs';
import {portfolio} from './portfolio.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const rows=correctTransactions(read('app/ledger.json')),snapshot=read('app/snapshot.json'),receipts=read('data/receipts.json');
for(const row of rows.filter(r=>r.category)){
 const live=await rpc('eth_getTransactionReceipt',[row.hash]);
 if(!live||live.status!=='0x1'||JSON.stringify(live.logs.map(l=>[l.address,l.topics,l.data]))!==JSON.stringify(receipts[row.hash].logs.map(l=>[l.address,l.topics,l.data])))throw Error('Receipt mismatch '+row.hash);
 console.log(row.hash.slice(0,12),row.action,row.token,row.usd);
}
const block=await rpc('eth_blockNumber',[]),p4=await state(block,pool4Config),p3=await state(block);
const blockInfo=await rpc('eth_getBlockByNumber',[block,false]);snapshot.block=Number(BigInt(block));snapshot.asOf=new Date(Number(BigInt(blockInfo.timestamp))*1000).toISOString();
if(p3.liquidity!=='0'||p4.liquidity!=='25927425798322537')throw Error('Position liquidity mismatch');
snapshot.pool3={...snapshot.pool3,...p3,active:false};snapshot.pool4=pool4Accounting(p4,rows);
snapshot.pool3.value=(p3.pons+snapshot.pool3.walletPons+p3.unclaimedPons)*p3.price+p3.usdg+snapshot.pool3.walletUsdg+p3.unclaimedUsdg;
snapshot.pool3.pnl=snapshot.pool3.value-snapshot.pool3.capital-snapshot.pool3.gas;
snapshot.pool3.roi=snapshot.pool3.pnl/(snapshot.pool3.capital+snapshot.pool3.gas)*100;
snapshot.totals=portfolio(rows,p3,[p4]);
snapshot.monitor.pending=rows.filter(r=>r.recognized===false).map(r=>r.hash);snapshot.reconciled=snapshot.monitor.pending.length===0&&snapshot.monitor.missingOutgoing===0;
for(const [path,data] of [['app/ledger.json',rows],['app/snapshot.json',snapshot]])fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({asOf:snapshot.asOf,pool4:p4,totals:snapshot.totals,reconciled:snapshot.reconciled},null,2));
