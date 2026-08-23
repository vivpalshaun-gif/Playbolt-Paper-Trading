'use client';

import { formatMoney } from '@/lib/format';
import { usePortfolio } from './PortfolioProvider';

export function CashAvailableCard() {
  const { cash } = usePortfolio();
  const cashText = cash != null ? formatMoney(cash) : 'Loading…';

  return (
    <article className="cash-card" aria-live="polite">
      <div className="cash-card-copy">
        <h2>Cash available to trade</h2>
        <p className="muted cash-card-hint">
          Remaining virtual cash after buys and sells
        </p>
      </div>
      <p className="cash-card-value">{cashText}</p>
    </article>
  );
}
