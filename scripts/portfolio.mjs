// Strategy balances are reconstructed from recorded cashflows, not historical valuations.
export function portfolio(rows,position){
 const sum=(items,key)=>items.reduce((n,r)=>n+r[key],0);
 const walletPons=sum(rows.filter(r=>r.symbol==='PONS'),'token');
 const walletUsdg=sum(rows,'usd');
 const independentPons=sum(rows.filter(r=>r.pool===4&&r.symbol==='PONS'),'token');
 const lpValue=position.pons*position.price+position.usdg;
 const unclaimedValue=position.unclaimedPons*position.price+position.unclaimedUsdg;
 const walletPonsValue=walletPons*position.price;
 const independentValue=independentPons*position.price;
 const value=lpValue+unclaimedValue+walletPonsValue+walletUsdg;
 const external=sum(rows.filter(r=>r.pool===0),'originalUsdt');
 const gas=sum(rows,'gasUsd');
 return {value,external,gas,frontCost:sum(rows,'cexCost'),pnl:value-external-gas,
  breakdown:{lpValue,unclaimedValue,walletPons,walletUsdg,walletPonsValue,independentPons,independentValue,lpRelatedWalletPons:walletPons-independentPons,lpRelatedWalletPonsValue:walletPonsValue-independentValue,method:'ledger-balances-v1'}};
}
