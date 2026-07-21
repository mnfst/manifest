import type { AppLocale } from '../common/i18n/locale';

export type SubscriptionEmailKind =
  | 'subscription_confirmed'
  | 'plan_changed'
  | 'cancellation_confirmed';
export type UsageEmailKind = 'requests_warning' | 'requests_limit_reached';

type SubscriptionSubjectFactory = (plan: string) => string;
type UsageSubjectFactory = (percentage: number) => string;

const SUBSCRIPTION_SUBJECTS = {
  en: {
    subscription_confirmed: (plan) => `Your Manifest ${plan} plan is active`,
    plan_changed: (plan) => `Your Manifest plan changed to ${plan}`,
    cancellation_confirmed: (plan) => `Your Manifest ${plan} cancellation is scheduled`,
  },
  ru: {
    subscription_confirmed: (plan) => `Тариф Manifest ${plan} активирован`,
    plan_changed: (plan) => `Ваш тариф Manifest изменён на ${plan}`,
    cancellation_confirmed: (plan) => `Отмена тарифа Manifest ${plan} запланирована`,
  },
} satisfies Record<AppLocale, Record<SubscriptionEmailKind, SubscriptionSubjectFactory>>;

const USAGE_SUBJECTS = {
  en: {
    requests_limit_reached: () => 'Your Manifest monthly request limit has been reached',
    requests_warning: (percentage) =>
      `Your Manifest workspace has used ${percentage}% of monthly requests`,
  },
  ru: {
    requests_limit_reached: () => 'Месячный лимит запросов Manifest исчерпан',
    requests_warning: (percentage) =>
      `Рабочее пространство Manifest использовало ${percentage}\u00a0% месячного лимита запросов`,
  },
} satisfies Record<AppLocale, Record<UsageEmailKind, UsageSubjectFactory>>;

export function planUsagePercentage(used: number, limit: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return 0;
  if (used >= limit) return 100;
  // Do not announce full usage while the raw value is still below the limit.
  return Math.min(99, Math.max(0, Math.round((used / limit) * 100)));
}

export function subscriptionEmailSubject(
  kind: SubscriptionEmailKind,
  plan: string,
  locale: AppLocale = 'en',
): string {
  return SUBSCRIPTION_SUBJECTS[locale][kind](plan);
}

export function usageEmailSubject(
  kind: UsageEmailKind,
  percentage: number,
  locale: AppLocale = 'en',
): string {
  return USAGE_SUBJECTS[locale][kind](percentage);
}
