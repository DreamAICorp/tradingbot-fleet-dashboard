import { ReactNode } from 'react';
import Head from 'next/head';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Head>
        <title>Fleet Dashboard — Realistic-Sweep Champions</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <header
        style={{
          padding: '10px 20px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-elev)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <strong style={{ fontSize: 15 }}>FLEET</strong>
        <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
          realistic-sweep champions · backtest vs live drift detector
        </span>
      </header>
      <main style={{ padding: 16 }}>{children}</main>
    </>
  );
}
