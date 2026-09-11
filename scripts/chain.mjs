import {AbiCoder,keccak256,solidityPackedKeccak256,toBeHex} from 'ethers';
const configuredRpc=(process.env.ROBINHOOD_RPC_URL||'').trim().replace(/^['"]|['"]$/g,'');
export const RPC=configuredRpc||'https://rpc.mainnet.chain.robinhood.com',WALLET='0x0df5590d07c493ecf14473979bf3d353cb2211ec',MANAGER='0x8366a39cc670b4001a1121b8f6a443a643e40951',POSITION='0x58daec3116aae6d93017baaea7749052e8a04fa7',POOL='0x4be9657ec9002e528f4f17a5c43edc525a07f888f7b180c2afbf75e096c4f38a';
export const PONS='0x39dbed3a2bd333467115de45665cc57f813c4571',USDG='0x5fc5360d0400a0fd4f2af552add042d716f1d168';
export const words=s=>(s.slice(2).match(/.{64}/g)||[]).map(x=>BigInt('0x'+x)),hex=n=>'0x'+BigInt(n).toString(16),abi=AbiCoder.defaultAbiCoder();
let lastRequest=0;
export async function rpc(method,params){const minInterval=method==='eth_getLogs'?3500:1200;for(let i=0;i<3;i++){let retryAfter=0;try{await new Promise(r=>setTimeout(r,Math.max(0,minInterval-(Date.now()-lastRequest))));lastRequest=Date.now();const res=await fetch(RPC,{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});const h=res.headers.get('retry-after');retryAfter=h?(Number.isFinite(Number(h))?Number(h)*1000:Math.max(0,Date.parse(h)-Date.now())):0;if(!res.ok){const detail=(await res.text()).slice(0,400);throw Error(`RPC ${method} HTTP ${res.status}: ${detail}`)}const j=await res.json();if(j.error)throw Error(JSON.stringify(j.error));return j.result}catch(e){if(i===2||retryAfter>60000)throw e;await new Promise(r=>setTimeout(r,Math.max(retryAfter,/429/.test(String(e))?15000*2**i:2000*2**i)))}}}
export function amounts(liquidity,sqrt){const s=Number(sqrt)/2**96,lo=1.0001**(-284340/2),hi=1.0001**(-270480/2),clamped=Math.max(lo,Math.min(s,hi));return {pons:Number(liquidity)*(1/clamped-1/hi)/1e18,usdg:Number(liquidity)*(clamped-lo)/1e6,price:s*s*1e12}}
export async function state(block='latest'){
const base=BigInt(keccak256(abi.encode(['bytes32','uint256'],[POOL,6])));
const pk=solidityPackedKeccak256(['address','int24','int24','bytes32'],[POSITION,-284340,-270480,toBeHex(1988906,32)]);
const pos=BigInt(keccak256(abi.encode(['bytes32','uint256'],[pk,base+6n])));
const tick=t=>BigInt(keccak256(abi.encode(['int256','uint256'],[t,base+4n])));
const slots=[base,base+1n,base+2n,pos,pos+1n,pos+2n,tick(-284340)+1n,tick(-284340)+2n,tick(-270480)+1n,tick(-270480)+2n];
const v=[];for(const slot of slots)v.push(BigInt(await rpc('eth_getStorageAt',[MANAGER,toBeHex(slot,32),block])));
const sqrt=v[0]&((1n<<160n)-1n),currentTick=Number(BigInt.asIntN(24,v[0]>>160n)),L=v[3]&((1n<<128n)-1n);const fg=i=>BigInt.asUintN(256,currentTick< -284340?v[6+i]-v[8+i]:currentTick>=-270480?v[8+i]-v[6+i]:v[1+i]-v[6+i]-v[8+i]);
const fees=[0,1].map(i=>BigInt.asUintN(256,fg(i)-v[4+i])*L/(1n<<128n));
return {...amounts(L,sqrt),liquidity:L.toString(),sqrt:sqrt.toString(),tick:currentTick,protocolFee:Number((v[0]>>184n)&0xffffffn),lpFee:Number((v[0]>>208n)&0xffffffn),unclaimedPons:Number(fees[0])/1e18,unclaimedUsdg:Number(fees[1])/1e6};}

