// Strategy balances are reconstructed from recorded cashflows, not historical valuations.
export function portfolio(rows,position,otherPositions=[]){
 const sum=(items,key)=>items.reduce((n,r)=>n+r[key],0);
 const walletPons=sum(rows.filter(r=>r.symbol==='PONS'),'token');
 const walletUsdg=sum(rows,'usd');
 const independentPons=sum(rows.filter(r=>(r.category==='investment'||(r.pool===4&&!r.category))&&r.symbol==='PONS'),'token');
 const lpValue=[position,...otherPositions].reduce((n,p)=>n+p.pons*position.price+p.usdg,0);
 const unclaimedValue=[position,...otherPositions].reduce((n,p)=>n+p.unclaimedPons*position.price+p.unclaimedUsdg,0);
 const walletPonsValue=walletPons*position.price;
 const independentValue=independentPons*position.price;
 const value=lpValue+unclaimedValue+walletPonsValue+walletUsdg;
 const external=sum(rows.filter(r=>r.pool===0),'originalUsdt');
 const gas=sum(rows,'gasUsd');
 return {value,external,gas,frontCost:sum(rows,'cexCost'),pnl:value-external-gas,
  breakdown:{lpValue,unclaimedValue,walletPons,walletUsdg,walletPonsValue,independentPons,independentValue,lpRelatedWalletPons:walletPons-independentPons,lpRelatedWalletPonsValue:walletPonsValue-independentValue,method:'ledger-balances-v1'}};
}
