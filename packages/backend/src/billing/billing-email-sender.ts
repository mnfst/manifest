import { render } from '@react-email/render';
import {
  PlanUsageEmail,
  PlanUsageEmailProps,
  SubscriptionPlanEmail,
  SubscriptionPlanEmailProps,
} from './emails/billing-plan-email';
import { sendEmail } from '../notifications/services/email-providers/send-email';
import type { AppLocale } from '../common/i18n/locale';

export function formatPlanName(plan: string | null | undefined): string {
  const normalized = (plan ?? '').trim().toLowerCase();
  if (normalized === 'pro') return 'Pro';
  if (normalized === 'free') return 'Free';
  if (!normalized) return 'Manifest';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getBillingEmailFrom(explicit?: string | null): string {
  return (
    explicit ||
    process.env['EMAIL_FROM'] ||
    process.env['NOTIFICATION_FROM_EMAIL'] ||
    'noreply@manifest.build'
  );
}

function normalizeAppUrl(appUrl: string): string {
  return appUrl.replace(/\/+$/, '') || 'https://app.manifest.build';
}

export function getBillingAppUrl(explicit?: string | null): string {
  return normalizeAppUrl(
    explicit || process.env['BETTER_AUTH_URL'] || 'https://app.manifest.build',
  );
}

export function subscriptionEmailSubject(
  kind: SubscriptionPlanEmailProps['kind'],
  plan: string,
  locale: AppLocale = 'en',
) {
  if (locale === 'ru') {
    if (kind === 'plan_changed') return `Ваш тариф Manifest изменён на ${plan}`;
    if (kind === 'cancellation_confirmed') return `Отмена тарифа Manifest ${plan} запланирована`;
    return `Тариф Manifest ${plan} активирован`;
  }
  if (kind === 'plan_changed') return `Your Manifest plan changed to ${plan}`;
  if (kind === 'cancellation_confirmed') return `Your Manifest ${plan} cancellation is scheduled`;
  return `Your Manifest ${plan} plan is active`;
}

export function usageEmailSubject(kind: PlanUsageEmailProps['kind'], locale: AppLocale = 'en') {
  if (locale === 'ru') {
    return kind === 'requests_limit_reached'
      ? 'Месячный лимит запросов Manifest исчерпан'
      : 'Рабочее пространство Manifest использовало 80\u00a0% месячного лимита запросов';
  }
  return kind === 'requests_limit_reached'
    ? 'Your Manifest monthly request limit has been reached'
    : 'Your Manifest workspace has used 80% of monthly requests';
}

export async function sendSubscriptionPlanEmail(
  to: string,
  props: SubscriptionPlanEmailProps,
  fromEmail?: string | null,
): Promise<boolean> {
  const element = SubscriptionPlanEmail(props);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return sendEmail({
    to,
    subject: subscriptionEmailSubject(props.kind, props.planName, props.locale),
    html,
    text,
    from: `Manifest <${getBillingEmailFrom(fromEmail)}>`,
  });
}

export async function sendPlanUsageEmail(
  to: string,
  props: PlanUsageEmailProps,
  fromEmail?: string | null,
): Promise<boolean> {
  const element = PlanUsageEmail(props);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return sendEmail({
    to,
    subject: usageEmailSubject(props.kind, props.locale),
    html,
    text,
    from: `Manifest <${getBillingEmailFrom(fromEmail)}>`,
  });
}
