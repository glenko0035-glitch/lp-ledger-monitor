import {updateBreakdown} from './breakdown.mjs';
import fs from 'node:fs';
import {refreshPool} from './pool-refresh.mjs';
import {rpc,state,words,hex,WALLET,MANAGER,POOL,PONS,USDG,amounts} from './chain.mjs';
const read=f=>JSON.parse(fs.readFileSync(f)),write=(f,x)=>{fs.writeFileSync(f+'.tmp',JSON.stringify(x,null,2));fs.renameSync(f+'.tmp',f)};
async function refresh(){
await refreshPool(); // Independent market snapshot survives wallet scan failure.
const cutoff=1788853787,transfer='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',modify='0xf208f4912782fd25c7f114ca3723a2d5dd6f3bcc3ac8db5af63baa85f711d5ec',topic='0x'+WALLET.slice(2).padStart(64,'0');
const receipts=read('data/receipts.json'),base=read('data/base-ledger.json'),head=Number(BigInt(await rpc('eth_blockNumber',[])))-20,block=await rpc('eth_getBlockByNumber',[hex(head),false]);
let monitor=fs.existsSync('data/monitor-state.json')?read('data/monitor-state.json'):{cutoff,nonce:45,lastBlock:0,discovered:[],nativeBalance:null};
if(!monitor.lastBlock){let lo=Number(BigInt(receipts['0xf3cfa2d431effd1cbda2fa84f92e54df08cc15a1517f3838b196eed8a17c39ac'].blockNumber)),hi=head;while(lo<hi){let mid=Math.floor((lo+hi)/2),b=await rpc('eth_getBlockByNumber',[hex(mid),false]);if(Number(BigInt(b.timestamp))<cutoff)lo=mid+1;else hi=mid}monitor.startBlock=lo;monitor.lastBlock=lo-1;}
const checkpointBlock=monitor.checkpointBlock??monitor.lastBlock;
if(monitor.blockHash){const checkpoint=await rpc('eth_getBlockByNumber',[hex(checkpointBlock),false]);if(checkpoint.hash!==monitor.blockHash)throw Error('監控游標區塊雜湊改變，需處理鏈重組後重試');}
const found=new Set(monitor.discovered);let savedCheckpoint=checkpointBlock;
async function discoverWalletTransactions(afterBlock){let url=`https://robinhoodchain.blockscout.com/api/v2/addresses/${WALLET}/transactions`;for(let page=0;page<20;page++){const res=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error(`Blockscout HTTP ${res.status}`);const data=await res.json(),items=data.items||[];for(const item of items){const blockNumber=Number(item.block_number||0);if(blockNumber>afterBlock)found.add(item.hash)}if(!data.next_page_params||items.some(item=>Number(item.block_number||0)<=afterBlock))break;url=`https://robinhoodchain.blockscout.com/api/v2/addresses/${WALLET}/transactions?${new URLSearchParams(data.next_page_params)}`;}}
await discoverWalletTransactions(monitor.lastBlock);
monitor.lastBlock=head;monitor.discovered=[...found];
const checkpoint=await rpc('eth_getBlockByNumber',[hex(head),false]);monitor.checkpointBlock=head;monitor.blockHash=checkpoint.hash;savedCheckpoint=head;write('data/monitor-state.json',monitor);
for(const hash of found)if(!receipts[hash])receipts[hash]=await rpc('eth_getTransactionReceipt',[hash]);
const nonce=Number(BigInt(await rpc('eth_getTransactionCount',[WALLET,hex(head)])));
const outgoing=[...found].filter(h=>receipts[h]?.from===WALLET).length;
const missing=Math.max(0,nonce-45-outgoing);
const s=await state(hex(head));const ethSlot=words(await rpc('eth_call',[{to:'0x52e65b17fb6e5ba00ed806f37afcd2daa50271ca',data:'0x3850c7bd'},hex(head)]))[0];const ethPrice=(Number(ethSlot)/2**96)**2*1e12;
const timestamp=Number(BigInt(block.timestamp)),asOf=new Date(timestamp*1000).toISOString();
function net(r,address,decimals){return r.logs.filter(l=>l.address===address&&l.topics[0]===transfer).reduce((n,l)=>n+(l.topics[2]?.endsWith(WALLET.slice(2))?Number(BigInt(l.data))/10**decimals:0)-(l.topics[1]?.endsWith(WALLET.slice(2))?Number(BigInt(l.data))/10**decimals:0),0)}
const two=['0xe01794acc47d16588aaa1b9b291f55e0dc74990a00ef63dc0cd2bd32e5dd1be0','0xf3cfa2d431effd1cbda2fa84f92e54df08cc15a1517f3838b196eed8a17c39ac'];
const funding=['0x5834f3d53b3516e048266ae94e1b64e1889c8c85e56a73420dfdebaab243358d','0xe68919aca35c1cdb900d89c44d53c38bcc2d98a0ad8daafc2cc7f8247b170b75'];
let rows=(fs.existsSync('app/ledger.json')?read('app/ledger.json'):base).map(x=>({...x}));const pending=[];
for(const hash of [...new Set([...funding,...two,...found])]){if(rows.some(r=>r.hash===hash))continue;const r=receipts[hash];const m=r.logs.find(l=>l.topics[0]===modify&&l.topics[1]===POOL);const mw=m?words(m.data):null;const knownPosition=mw&&mw[3]===1988906n;
const usd=net(r,USDG,6),token=net(r,PONS,18);const isFunding=funding.includes(hash);const approval=r.logs.length>0&&r.from===WALLET&&r.logs.every(l=>[PONS,USDG].includes(l.address)&&l.topics[0]==='0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'&&l.topics[1]===topic);const routedSwap=usd<0&&token>0;const knownSwap=hash==='0x078ae0e388c756a9e8085f7f76887e0a9b4c96e8376c9838f111dbf5c1d281cb'||routedSwap;const recognized=isFunding||knownPosition||approval||knownSwap; if(!recognized)pending.push(hash);
const pendingDecision=routedSwap&&hash==='0x5cb234a261e7717f96fa8f6ad480c936d8324fb2ed2bc1bd499afcedd3ba90e7';
rows.push({pool:isFunding?0:pendingDecision?4:recognized?3:-1,hash,time:'',action:isFunding?'外部本金到賬':approval?'代幣授權':pendingDecision?'換幣／待決策持倉':knownSwap?'換幣':knownPosition?(BigInt.asIntN(256,mw[2])===0n?'收取費用':BigInt.asIntN(256,mw[2])>0n?'加倉 / 費用抵扣':'減少流動性'):'新交易待分類',usd,token,symbol:'PONS',recognized});}
for(const r of rows){const receipt=receipts[r.hash];const ts=Number(BigInt(receipt.logs.find(l=>l.blockTimestamp&&l.blockTimestamp!=='0x0')?.blockTimestamp||'0x0'));r.timestamp=ts||0;if(ts)r.time=new Date((ts+28800)*1000).toISOString().slice(5,16).replace('T',' ');r.gasEth=Number(BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice))/1e18;r.gasPaidByWallet=receipt.from===WALLET;r.gasPriceUsd=r.pool===1?2458.460992:r.pool===2?2495.24248:ethPrice;r.gasUsd=r.gasPaidByWallet?r.gasEth*r.gasPriceUsd:0;r.gasValuation=r.pool===1?'池一退出時點':r.pool===2?'池二退出時點':asOf;r.gasPayer=receipt.from;r.cexCost=funding.indexOf(r.hash)===0?8.23:funding.indexOf(r.hash)===1?1.137608:0;r.originalUsdt=funding.indexOf(r.hash)===0?10003:funding.indexOf(r.hash)===1?1331.61:0;}
rows.sort((a,b)=>a.time.localeCompare(b.time));
let walletP=19.104282695661706,walletU=19.891201;for(const r of rows.filter(r=>r.pool===3&&!base.some(b=>b.hash===r.hash))){walletP+=r.token;walletU+=r.usd}
const strategyTransfer=Math.max(0,-walletU);walletU+=strategyTransfer;
const gas3=rows.filter(r=>r.pool===3).reduce((a,r)=>a+r.gasUsd,0),gasAll=rows.reduce((a,r)=>a+r.gasUsd,0),capital=9801.946811812868+strategyTransfer;
const value=(s.pons+walletP+s.unclaimedPons)*s.price+s.usdg+walletU+s.unclaimedUsdg;
const expectedLiquidity=17861942714573618n+[...new Set([...two,...found])].reduce((n,h)=>n+receipts[h].logs.filter(l=>l.topics[0]===modify&&l.topics[1]===POOL&&words(l.data)[3]===1988906n).reduce((a,l)=>a+BigInt.asIntN(256,words(l.data)[2]),0n),0n);
const collected=rows.filter(r=>r.pool===3&&['提取手續費','收取費用'].includes(r.action)).reduce((a,r)=>({pons:a.pons+r.token,usdg:a.usdg+r.usd}),{pons:0,usdg:0});
let reconciled=missing===0&&pending.length===0&&expectedLiquidity.toString()===s.liquidity&&walletP>=-1e-6&&walletU>=-1e-6;
const apr={value:null,volume24h:null,tvl:null,status:'官方APR待接入',source:'https://developers.uniswap.org/docs/api-reference/pool_info',sampledAt:asOf};
// Only verified official displayed APR observations are eligible. Never derive APR.
const samples=(fs.existsSync('data/apr-samples.json')?read('data/apr-samples.json'):[]).filter(x=>x.method==='official-display');
monitor.lastChecked=asOf;monitor.nonce=nonce;monitor.missingOutgoing=missing;monitor.pending=pending;write('data/monitor-state.json',monitor);
const snapshot={asOf,block:head,reconciled,monitor,apr,aprSamples:samples.slice(-720),pool3:{...s,collected,strategyTransfer,walletPons:walletP,walletUsdg:walletU,capital,value,gas:gas3,pnl:value-capital-gas3,roi:(value-capital-gas3)/(capital+gas3)*100},totals:{gas:gasAll,frontCost:9.367608,external:11334.61,value:11925.7305870468-9129.70486823247-strategyTransfer+value,pnl:2606.6796077-1346.627199+(value-capital-gas3)},newOperations:two.map(h=>rows.find(r=>r.hash===h))};
const latestAddRow=rows.filter(r=>r.pool===3&&r.action==='加倉 / 費用抵扣').at(-1);if(latestAddRow){try{await updateBreakdown(latestAddRow,receipts[latestAddRow.hash])}catch{ /* Keep verified net cashflows when historical valuation is unavailable. */ }}
write('app/snapshot.json',snapshot);console.log(JSON.stringify(snapshot,null,2));
write('data/receipts.json',receipts);write('app/ledger.json',rows);

}
try{await refresh();if(fs.existsSync('data/last-error.json'))fs.unlinkSync('data/last-error.json')}catch(error){fs.writeFileSync('data/last-error.json',JSON.stringify({time:new Date().toISOString(),message:String(error)},null,2));console.error(String(error));process.exitCode=1}
