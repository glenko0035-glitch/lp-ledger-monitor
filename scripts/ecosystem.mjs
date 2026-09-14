import fs from 'node:fs';
const file='app/ecosystem/data.json';
const specs={7915153:['chain','day','dex','volume_usd'],7979343:['launchpads','day','launchpad','volume_usd'],7982742:['pons','day',null,'volume_usd'],7999799:['revenue','day',null,'protocol_revenue_usd'],5440992:['platforms','day','project','token_volume_usd'],7979369:['launches',null,'launchpad','tokens_created'],7982751:['burn','hour',null,'cumulative_burned']};
export function normalize(id,body){
 const [metric,date,group,field]=specs[id];
 if(body.state!=='QUERY_STATE_COMPLETED'||!body.result?.rows?.length)throw Error('结果未完成或为空');
 const cols=body.result.metadata.column_names;
 if([date,group,field].filter(Boolean).some(k=>!cols.includes(k)))throw Error('字段结构变化');
 const points=body.result.rows.map(r=>({date:date?r[date]:null,group:group?r[group]:null,value:r[field]}));
 if(points.some(p=>p.value!==null&&(typeof p.value!=='number'||!Number.isFinite(p.value)||p.value<0)))throw Error('数值异常');
 return {metric,queryId:Number(id),executedAt:body.execution_ended_at,fetchedAt:new Date().toISOString(),error:null,points};
}
const old=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{sources:{}};
if(process.argv.includes('--seed')){
 const audit=JSON.parse(fs.readFileSync('../dune-audit-full/dune-audit.json','utf8'));
 for(const q of audit.queries)if(specs[q.id]){if(!q.complete)throw Error('Seed incomplete');old.sources[specs[q.id][0]]={...normalize(q.id,q.result.body),fetchedAt:audit.checkedAt}}
}else{
 async function get(path){for(let n=0;n<3;n++){const r=await fetch('https://api.dune.com/api/v1/'+path,{headers:{'X-Dune-API-Key':process.env.DUNE_API_KEY||''},signal:AbortSignal.timeout(45000)});if(r.ok)return r.json();if((r.status===429||r.status>=500)&&n<2){await new Promise(r=>setTimeout(r,3000*(n+1)));continue}throw Error('Dune HTTP '+r.status)}}
 for(const [id,[metric]] of Object.entries(specs)){
  const prev=old.sources[metric];
  if(prev&&!prev.error&&Date.now()-Date.parse(prev.fetchedAt)<8*3600000)continue;
  try{const b=await get('query/'+id+'/results?limit=1000');let offset=b.next_offset;let pages=1;while(offset!=null){if(++pages>100)throw Error('分页超过限制');const p=await get('execution/'+b.execution_id+'/results?limit=1000&offset='+offset);b.result.rows.push(...p.result.rows);if(p.next_offset!=null&&p.next_offset<=offset)throw Error('分页未推进');offset=p.next_offset}if(b.result.rows.length!==b.result.metadata.total_row_count)throw Error('结果不完整');old.sources[metric]=normalize(id,b)}catch(e){old.sources[metric]={...prev,metric,queryId:Number(id),error:String(e),attemptedAt:new Date().toISOString(),points:prev?.points||[]};console.log(metric,String(e))}
 }
}
fs.mkdirSync('app/ecosystem',{recursive:true});fs.writeFileSync(file,JSON.stringify(old));
