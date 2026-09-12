import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'LP 觀測台｜倉位與收益',description:'個人 LP 倉位結算、費用與收益趨勢。僅納入已確認交易。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-Hant"><body>{children}</body></html>}
