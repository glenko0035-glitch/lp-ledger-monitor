import fs from 'node:fs';
import {rpc,state,words,hex,WALLET,MANAGER,POOL,PONS,USDG,amounts} from './chain.mjs';
const read=f=>JSON.parse(fs.readFileSync(f)),write=(f,x)=>{fs.writeFileSync(f+'.tmp',JSON.stringify(x,null,2));fs.renameSync(f+'.tmp',f)};
async function refresh(){
const cutoff=1788853787,transfer='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',modify='0xf208f4912782fd25c7f114ca3723a2d5dd6f3bcc3ac8db5af63baa85f711d5ec',topic='0x'+WALLET.slice(2).padStart(64,'0');
const receipts=read('data/receipts.json'),base=read('data/base-ledger.json'),head=Number(BigInt(await rpc('eth_blockNumber',[])))-20,block=await rpc('eth_getBlockByNumber',[hex(head),false]);
let monitor=fs.existsSync('data/monitor-state.json')?read('data/monitor-state.json'):{cutoff,nonce:45,lastBlock:0,discovered:[],nativeBalance:null};
if(!monitor.lastBlock){let lo=Number(BigInt(receipts['0xf3cfa2d431effd1cbda2fa84f92e54df08cc15a1517f3838b196eed8a17c39ac'].blockNumber)),hi=head;while(lo<hi){let mid=Math.floor((lo+hi)/2),b=await rpc('eth_getBlockByNumber',[hex(mid),false]);if(Number(BigInt(b.timestamp))<cutoff)lo=mid+1;else hi=mid}monitor.startBlock=lo;monitor.lastBlock=lo-1;}
async function logs(from,to,topics){if(from>to)return[];try{return await rpc('eth_getLogs',[{fromBlock:hex(from),toBlock:hex(to),topics}])}catch(e){if(to-from<30)throw e;let m=Math.floor((from+to)/2);return [...await logs(from,m,topics),...await logs(m+1,to,topics)]}}
if(monitor.blockHash){const checkpoint=await rpc('eth_getBlockByNumber',[hex(monitor.lastBlock),false]);if(checkpoint.hash!==monitor.blockHash)throw Error('監控游標區塊雜湊改變，需處理鏈重組後重試');}
const found=new Set(monitor.discovered);for(const topics of [[null,topic],[null,null,topic]]){for(let from=monitor.lastBlock+1;from<=head;from+=10000){for(const l of await logs(from,Math.min(head,from+9999),topics))found.add(l.transactionHash)}}
for(const hash of found)if(!receipts[hash])receipts[hash]=await rpc('eth_getTransactionReceipt',[hash]);
const nonce=Number(BigInt(await rpc('eth_getTransactionCount',[WALLET,hex(head)])));
const outgoing=[...found].filter(h=>receipts[h]?.from===WALLET).length;
const missing=Math.max(0,nonce-45-outgoing);
const s=await state(hex(head));const ethSlot=words(await rpc('eth_call',[{to:'0x52e65b17fb6e5ba00ed806f37afcd2daa50271ca',data:'0x3850c7bd'},hex(head)]))[0];const ethPrice=(Number(ethSlot)/2**96)**2*1e12;
const timestamp=Number(BigInt(block.timestamp)),asOf=new Date(timestamp*1000).toISOString();
function net(r,address,decimals){return r.logs.filter(l=>l.address===address&&l.topics[0]===transfer).reduce((n,l)=>n+(l.topics[2]?.endsWith(WALLET.slice(2))?Number(BigInt(l.data))/10**decimals:0)-(l.topics[1]?.endsWith(WALLET.slice(2))?Number(BigInt(l.data))/10**decimals:0),0)}
const two=['0xe01794acc47d16588aaa1b9b291f55e0dc74990a00ef63dc0cd2bd32e5dd1be0','0xf3cfa2d431effd1cbda2fa84f92e54df08cc15a1517f3838b196eed8a17c39ac'];
const funding=['0x5834f3d53b3516e048266ae94e1b64e1889c8c85e56a73420dfdebaab243358d','0xe68919aca35c1cdb900d89c44d53c38bcc2d98a0ad8daafc2cc7f8247b170b75'];
let rows=base.map(x=>({...x}));const pending=[];
for(const hash of [...new Set([...funding,...two,...found])]){if(rows.some(r=>r.hash===hash))continue;const r=receipts[hash];const m=r.logs.find(l=>l.topics[0]===modify&&l.topics[1]===POOL);const mw=m?words(m.data):null;const knownPosition=mw&&mw[3]===1988906n;
const isFunding=funding.includes(hash);const approval=r.logs.length>0&&r.from===WALLET&&r.logs.every(l=>[PONS,USDG].includes(l.address)&&l.topics[0]==='0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'&&l.topics[1]===topic);const knownSwap=hash==='0x078ae0e388c756a9e8085f7f76887e0a9b4c96e8376c9838f111dbf5c1d281cb';const recognized=isFunding||knownPosition||approval||knownSwap; if(!recognized)pending.push(hash);
rows.push({pool:isFunding?0:recognized?3:-1,hash,time:'',action:isFunding?'外部本金到賬':approval?'代幣授權':knownSwap?'換幣':knownPosition?(BigInt.asIntN(256,mw[2])===0n?'收取費用':BigInt.asIntN(256,mw[2])>0n?'加倉 / 費用抵扣':'減少流動性'):'新交易待分類',usd:net(r,USDG,6),token:net(r,PONS,18),symbol:'PONS',recognized});}
for(const r of rows){const receipt=receipts[r.hash];const ts=Number(BigInt(receipt.logs.find(l=>l.blockTimestamp&&l.blockTimestamp!=='0x0')?.blockTimestamp||'0x0'));r.timestamp=ts||0;if(ts)r.time=new Date((ts+28800)*1000).toISOString().slice(5,16).replace('T',' ');r.gasEth=Number(BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice))/1e18;r.gasPaidByWallet=receipt.from===WALLET;r.gasPriceUsd=r.pool===1?2458.460992:r.pool===2?2495.24248:ethPrice;r.gasUsd=r.gasPaidByWallet?r.gasEth*r.gasPriceUsd:0;r.gasValuation=r.pool===1?'池一退出時點':r.pool===2?'池二退出時點':asOf;r.gasPayer=receipt.from;r.cexCost=funding.indexOf(r.hash)===0?8.23:funding.indexOf(r.hash)===1?1.137608:0;r.originalUsdt=funding.indexOf(r.hash)===0?10003:funding.indexOf(r.hash)===1?1331.61:0;}
rows.sort((a,b)=>a.time.localeCompare(b.time));
let walletP=19.104282695661706,walletU=19.891201;for(const r of rows.filter(r=>r.pool===3&&!base.some(b=>b.hash===r.hash))){walletP+=r.token;walletU+=r.usd}
const strategyTransfer=Math.max(0,-walletU);walletU+=strategyTransfer;
const gas3=rows.filter(r=>r.pool===3).reduce((a,r)=>a+r.gasUsd,0),gasAll=rows.reduce((a,r)=>a+r.gasUsd,0),capital=9801.946811812868+strategyTransfer;
const value=(s.pons+walletP+s.unclaimedPons)*s.price+s.usdg+walletU+s.unclaimedUsdg;
const expectedLiquidity=17861942714573618n+[...new Set([...two,...found])].reduce((n,h)=>n+receipts[h].logs.filter(l=>l.topics[0]===modify&&l.topics[1]===POOL&&words(l.data)[3]===1988906n).reduce((a,l)=>a+BigInt.asIntN(256,words(l.data)[2]),0n),0n);
const collected=rows.filter(r=>r.pool===3&&['提取手續費','收取費用'].includes(r.action)).reduce((a,r)=>({pons:a.pons+r.token,usdg:a.usdg+r.usd}),{pons:0,usdg:0});
let reconciled=missing===0&&pending.length===0&&expectedLiquidity.toString()===s.liquidity&&walletP>=-1e-6&&walletU>=-1e-6;
let apr={value:null,volume24h:null,tvl:null,status:'資料暫缺',lpFee:0.003,source:'https://interface.gateway.uniswap.org/v1/graphql',sampledAt:asOf};
try{const query='query($chain:Chain!,$poolId:String!){v4Pool(chain:$chain,poolId:$poolId){isDynamicFee volume24h:cumulativeVolume(duration:DAY){value} totalLiquidity{value}}}';const j=await(await fetch(apr.source,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,variables:{chain:'ROBINHOOD',poolId:POOL}}),signal:AbortSignal.timeout(15000)})).json();const p=j.data?.v4Pool;apr.volume24h=p?.volume24h?.value??null;apr.tvl=p?.totalLiquidity?.value??null;if(!p?.isDynamicFee&&apr.volume24h!==null&&apr.tvl>0){apr.value=Math.round(apr.volume24h*.003*365)/Math.round(apr.tvl)*100;apr.status='已更新'}else apr.status='24小時成交量暫缺';}catch(e){apr.status='APR來源暫時無法連線'}
const samples=fs.existsSync('data/apr-samples.json')?read('data/apr-samples.json'):[];if(apr.value!==null&&!samples.some(x=>x.sampledAt.slice(0,13)===asOf.slice(0,13)))samples.push(apr);write('data/apr-samples.json',samples);
const balance=Number(BigInt(await rpc('eth_getBalance',[WALLET,hex(head)])))/1e18;
const newGas=[...found].filter(h=>!monitor.discovered.includes(h)&&receipts[h]?.from===WALLET).reduce((a,h)=>a+Number(BigInt(receipts[h].gasUsed)*BigInt(receipts[h].effectiveGasPrice))/1e18,0);
const nativeResidual=(monitor.nativeResidual||0)+(monitor.nativeBalance===null?0:balance-monitor.nativeBalance+newGas);
if(Math.abs(nativeResidual)>1e-10)reconciled=false;
monitor={...monitor,nativeResidual,lastBlock:head,blockHash:block.hash,discovered:[...found],nonce,lastChecked:asOf,missingOutgoing:missing,pending,nativeBalance:balance,coverage:'ERC20/NFT事件與發出交易nonce核對；無日誌操作或原生ETH轉入需另核驗'};
write('data/receipts.json',receipts);write('data/monitor-state.json',monitor);write('app/ledger.json',rows);
const snapshot={asOf,block:head,reconciled,monitor,apr,aprSamples:samples.slice(-720),pool3:{...s,collected,strategyTransfer,walletPons:walletP,walletUsdg:walletU,capital,value,gas:gas3,pnl:value-capital-gas3,roi:(value-capital-gas3)/(capital+gas3)*100},totals:{gas:gasAll,frontCost:9.367608,external:11334.61,value:11925.7305870468-9129.70486823247-strategyTransfer+value,pnl:2606.6796077-1346.627199+(value-capital-gas3)},newOperations:two.map(h=>rows.find(r=>r.hash===h))};
write('app/snapshot.json',snapshot);console.log(JSON.stringify(snapshot,null,2));

}
try{await refresh();if(fs.existsSync('data/last-error.json'))fs.unlinkSync('data/last-error.json')}catch(error){fs.writeFileSync('data/last-error.json',JSON.stringify({time:new Date().toISOString(),message:String(error)},null,2));console.error(String(error));process.exitCode=1}
