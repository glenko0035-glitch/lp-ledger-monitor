import fs from 'node:fs';
import {abi,rpc,MANAGER} from './chain.mjs';
import {keccak256,toBeHex} from 'ethers';
export const poolId='0x4be9657ec9002e528f4f17a5c43edc525a07f888f7b180c2afbf75e096c4f38a';
const source='https://interface.gateway.uniswap.org/v1/graphql';
const query=`query V4Pool($chain:Chain!,$poolId:String!){v4Pool(chain:$chain,poolId:$poolId){poolId feeTier isDynamicFee token0{address decimals market(currency:USD){price{value}}} token1{address decimals market(currency:USD){price{value}}} token0Supply token1Supply volume24h:cumulativeVolume(duration:DAY){value} totalLiquidity{value} rewardsCampaign{boostedApr startTimestamp endTimestamp}}}`;
const read=(p,f)=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):f;
const write=(p,v)=>{fs.writeFileSync(p+'.tmp',JSON.stringify(v,null,2));fs.renameSync(p+'.tmp',p)};
const num=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:null;
export function derive(p){
 if(p.poolId!==poolId||p.token0?.address?.toLowerCase()!=='0x39dbed3a2bd333467115de45665cc57f813c4571'||p.token1?.address?.toLowerCase()!=='0x5fc5360d0400a0fd4f2af552add042d716f1d168'||p.token0.decimals!==18||p.token1.decimals!==6)throw Error('池子或代幣順序/精度不符');
 const ponsPrice=num(p.token0.market?.price?.value),usdgPrice=num(p.token1.market?.price?.value),ponsReserves=num(p.token0Supply),usdgReserves=num(p.token1Supply),officialTvl=num(p.totalLiquidity?.value),volume24h=num(p.volume24h?.value);
 const reserveTvl=[ponsPrice,usdgPrice,ponsReserves,usdgReserves].every(x=>x!==null)?ponsPrice*ponsReserves+usdgPrice*usdgReserves:null;
 // The API's blended feeTier is not a verified LP-only fee. Never silently turn it into income.
 return {ponsPrice,usdgPrice,ponsReserves,usdgReserves,officialTvl,reserveTvl,volume24h,apiFeePips:num(p.feeTier),feeTier:null,fees24h:null,apr:null,officialApr:null,apy:null,tvlDifference:officialTvl>0&&reserveTvl!==null?(reserveTvl/officialTvl-1)*100:null,isDynamicFee:p.isDynamicFee};
}
export async function refreshPool(){
 const path='app/pool-market.json',old=read(path,{latest:null,history:[]}),attemptedAt=new Date().toISOString();
 try{
  const r=await fetch(source,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://app.uniswap.org'},body:JSON.stringify({query,variables:{chain:'ROBINHOOD',poolId}}),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('池子統計接口 HTTP '+r.status);const j=await r.json();if(!j.data?.v4Pool)throw Error('池子統計未返回資料');
  const latest={...derive(j.data.v4Pool),sampledAt:attemptedAt,blockNumber:null,source,status:'部分資料可用',errors:(j.errors||[]).map(e=>({field:e.path?.at(-1),message:e.message})),method:'official-api',reserveMethod:'GraphQL tokenSupply；非 pool_info 儲備，口徑待比對'};
  try{const block=await rpc('eth_blockNumber',[]);const slot=BigInt(await rpc('eth_getStorageAt',[MANAGER,toBeHex(BigInt(keccak256(abi.encode(['bytes32','uint256'],[poolId,6]))),32),block]));latest.blockNumber=Number(BigInt(block));latest.feeTier=Number((slot>>208n)&0xffffffn)/1e6;latest.protocolFeePips=Number((slot>>184n)&0xffffffn);
   if(!latest.isDynamicFee&&latest.volume24h!==null&&latest.officialTvl>0&&latest.feeTier<=1){latest.fees24h=latest.volume24h*latest.feeTier;latest.apr=latest.fees24h/latest.officialTvl*365*100;latest.apy=Math.expm1(365*Math.log1p(latest.apr/100/365))*100;latest.status='統計已更新';latest.aprMethod='按官方成交量與鏈上LP費率估算；非官方Total APR，未加獎勵';}
  }catch(e){latest.errors.push({field:'chain',message:String(e)})}
  const bucket=Math.floor(Date.parse(attemptedAt)/28800000),history=(old.history||[]).filter(s=>Math.floor(Date.parse(s.sampledAt)/28800000)!==bucket);history.push(latest);
  write(path,{latest,history,attemptedAt,lastError:null,poolInfoConfigured:!!process.env.UNISWAP_API_KEY});
  write('data/pool-source-response.json',{attemptedAt,source,response:j});console.log(JSON.stringify({poolRefresh:true,latest}));return true;
 }catch(e){write(path,{...old,attemptedAt,lastError:String(e)});console.error(String(e));return false}
}
if(process.argv[1]?.endsWith('pool-refresh.mjs'))await refreshPool();
