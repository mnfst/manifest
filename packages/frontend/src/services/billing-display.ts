import { PLAN_LIMITS, type BillingPrice } from 'manifest-shared';
import { formatNumber, t } from '../i18n/index.js';

export const FREE_REQUEST_LIMIT = PLAN_LIMITS.free.requestsPerMonth ?? 0;
export const FREE_REQUEST_LIMIT_LABEL = FREE_REQUEST_LIMIT.toLocaleString('en-US');

export function freeRequestLimitLabel(): string {
  return formatNumber(FREE_REQUEST_LIMIT);
}

export function formatBillingPrice(price: BillingPrice | null | undefined): string | null {
  if (price?.amount == null || !price.currency) return null;
  const wholeAmount = Number.isInteger(price.amount);
  try {
    return formatNumber(price.amount, {
      style: 'currency',
      currency: price.currency,
      minimumFractionDigits: wholeAmount ? 0 : undefined,
      maximumFractionDigits: wholeAmount ? 0 : undefined,
    });
  } catch {
    return `${formatNumber(price.amount)} ${price.currency}`;
  }
}

export function billingIntervalSuffix(price: BillingPrice | null | undefined): string {
  if (!price?.interval) return '';
  if (price.interval === 'month') return t('services.billing.perMonth');
  if (price.interval === 'year') return t('services.billing.perYear');
  return `/${price.interval}`;
}

export function formatBillingPriceWithInterval(
  price: BillingPrice | null | undefined,
): string | null {
  const formatted = formatBillingPrice(price);
  return formatted ? `${formatted}${billingIntervalSuffix(price)}` : null;
}
