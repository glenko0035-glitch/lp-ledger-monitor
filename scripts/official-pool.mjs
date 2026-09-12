import fs from 'node:fs';
import {chromium} from 'playwright';
const file='app/official-pool.json',url='https://app.uniswap.org/explore/pools/robinhood/0x4be9657ec9002e528f4f17a5c43edc525a07f888f7b180c2afbf75e096c4f38a';
const history=JSON.parse(fs.readFileSync(file,'utf8'));
const usd=s=>{const m=s.match(/([\d,.]+)\s*([KMBT])?/i);return Number(m[1].replaceAll(',',''))*({K:1e3,M:1e6,B:1e9,T:1e12}[m[2]?.toUpperCase()]||1)};
let error;
for(let attempt=0;attempt<3;attempt++){
 let browser;
 try{
  browser=await chromium.launch({headless:process.env.HEADED!=='1'});
  const page=await browser.newPage({locale:'en-US'});
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByText('24H fees',{exact:false}).first().waitFor({timeout:60000});
  let sample;
  for(let i=0;i<20;i++){
   const body=(await page.locator('body').innerText()).replace(/\u00a0/g,' ');
   const apr=body.match(/Total APR\s+([\d,.]+)%/i),tvl=body.match(/TVL\s+\$\s*([\d,.]+\s*[KMBT]?)/i),volume=body.match(/24H volume\s+\$\s*([\d,.]+\s*[KMBT]?)/i),fees=body.match(/24H fees\s+\$\s*([\d,.]+\s*[KMBT]?)/i);
   if(apr&&tvl&&volume&&fees){sample={sampledAt:new Date().toISOString(),officialApr:Number(apr[1].replaceAll(',','')),tvlUsd:usd(tvl[1]),volume24hUsd:usd(volume[1]),fees24hUsd:usd(fees[1])};break}
   await page.waitForTimeout(1000);
  }
  if(!sample||Object.values(sample).some(v=>typeof v==='number'&&(!Number.isFinite(v)||v<0))||sample.tvlUsd<=0)throw Error('Official Stats incomplete');
  history.samples.push(sample);history.lastError=null;history.lastAttemptAt=sample.sampledAt;
  fs.writeFileSync(file,JSON.stringify(history,null,2));console.log(JSON.stringify(sample));error=null;break;
 }catch(e){error=String(e);console.warn('Official page attempt failed: '+error)}finally{await browser?.close()}
}
if(error){history.lastError='官方頁面採集失敗，保留最近成功數據';history.lastAttemptAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(history,null,2));process.exitCode=1}
