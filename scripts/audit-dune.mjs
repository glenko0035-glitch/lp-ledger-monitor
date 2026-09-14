import fs from 'node:fs';
const ids=[7915153,7979343,7982742,7999799,5440992,7979369,7982751,8694334];
const key=process.env.DUNE_API_KEY;
if(!key)throw Error('DUNE_API_KEY is missing');
const report={checkedAt:new Date().toISOString(),queries:[]};
async function get(path){
 const r=await fetch('https://api.dune.com/api/v1/'+path,{headers:{'X-Dune-API-Key':key},signal:AbortSignal.timeout(60000)});
 const body=await r.json();return {status:r.status,body};
}
for(const id of ids){
 const q={id};
 try{
  q.definition=await get('query/'+id);
  q.result=await get('query/'+id+'/results?limit=1000');
  console.log(JSON.stringify({id,definitionStatus:q.definition.status,resultStatus:q.result.status,metadata:q.result.body.result?.metadata,state:q.result.body.state}));
 }catch(e){q.error=String(e);console.log(id,'request failed');}
 report.queries.push(q);
}
fs.mkdirSync('audit-output',{recursive:true});
fs.writeFileSync('audit-output/dune-audit.json',JSON.stringify(report,null,2));
