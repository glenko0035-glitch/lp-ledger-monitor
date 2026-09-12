'use client';
import './trend.css';
import {useEffect,useState} from 'react';
import {ResponsiveContainer,AreaChart,Area,XAxis,YAxis,Tooltip,CartesianGrid} from 'recharts';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import history from './official-pool.json';
const metrics={officialApr:'APR',tvlUsd:'TVL',volume24hUsd:'24H Volume',fees24hUsd:'24H Fees'};
type Metric=keyof typeof metrics;
const ranges={'24H':24,'7D':168,'30D':720,'全部':Infinity};
const value=(n:number,key:Metric)=>key==='officialApr'?n.toLocaleString('en-US',{maximumFractionDigits:2})+'%':'$'+n.toLocaleString('en-US',{notation:'compact',maximumFractionDigits:2});
const time=(n:number)=>new Date(n).toLocaleString('zh-TW',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
export default function PoolTrend(){
 const [metric,setMetric]=useState<Metric>('officialApr'),[range,setRange]=useState<keyof typeof ranges>('7D'),[now,setNow]=useState(0);
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer)},[]);
 const samples=history.samples.map(s=>({...s,t:Date.parse(s.sampledAt)})).sort((a,b)=>a.t-b.t),latest=samples.at(-1);
 const shown=samples.filter(s=>s.t>=(now||latest?.t||0)-ranges[range]*3600000),stale=latest&&now-latest.t>3*3600000;
 return <section className="panel pool-trend"><div className="panel-top"><div><h2>池子趨勢</h2><p>PONS / USDG · 池三</p></div><span className={'badge '+(stale||history.lastError?'amber':'live')}>{history.lastError?'採集暫未成功':stale?'等待更新':'Uniswap 官方'}</span></div>
 <div className="trend-controls"><Tabs value={metric} onValueChange={v=>setMetric(v as Metric)}><TabsList aria-label="選擇指標">{Object.entries(metrics).map(([key,label])=><TabsTrigger key={key} value={key}>{label}</TabsTrigger>)}</TabsList></Tabs><Tabs value={range} onValueChange={v=>setRange(v as keyof typeof ranges)}><TabsList aria-label="選擇時間範圍">{Object.keys(ranges).map(key=><TabsTrigger key={key} value={key}>{key}</TabsTrigger>)}</TabsList></Tabs></div>
 <div className="apr-current"><span>{metric==='officialApr'?'官方 Total APR':metrics[metric]}</span><strong>{latest?value(latest[metric],metric):'—'}</strong><small>{latest?'最後採樣 '+time(latest.t)+'（北京時間）':'等待首筆官方樣本'}</small></div>
 <div style={{height:260,width:'100%',minWidth:0}}>{shown.length?<ResponsiveContainer width="100%" height="100%"><AreaChart data={shown} margin={{top:15,right:14,bottom:8,left:0}}><defs><linearGradient id="pool-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2598ba" stopOpacity={.18}/><stop offset="100%" stopColor="#2598ba" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e6edf0"/><XAxis dataKey="t" type="number" domain={['dataMin','dataMax']} tickFormatter={n=>time(n)} minTickGap={55} tick={{fontSize:12}}/><YAxis domain={['auto','auto']} tickFormatter={n=>value(n,metric)} width={72} tick={{fontSize:12}}/><Tooltip content={({active,payload})=>{const point=payload?.[0]?.payload;return active&&point?<div className="trend-tooltip"><strong>{time(point.t)}</strong>{Object.entries(metrics).map(([key,label])=><div key={key}>{label}<b>{value(point[key],key as Metric)}</b></div>)}</div>:null}}/><Area type="linear" dataKey={metric} stroke="#258caf" strokeWidth={2.2} fill="url(#pool-fill)" dot={shown.length<3?{r:4}:false} connectNulls={false} isAnimationActive={false}/></AreaChart></ResponsiveContainer>:<div className="empty-chart"><p>此時間範圍暫無樣本，請切換更長範圍。</p></div>}</div>
 <p className="footnote">{shown.length} 個採樣點 · 每小時採集；24H 指標為滾動窗口。數值保留官方頁面顯示精度。</p>
 </section>
}
