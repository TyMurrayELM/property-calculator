export const HOURLY_RATES = {
  PHX: {
    MOBILE: 25.33,
    ONSITE: 30.22,
  },
  LV: {
    MOBILE: 24.06,
    ONSITE: 24.83,
  },
} as const;

export const WEEKS_PER_MONTH = 4.33;

export type Market = keyof typeof HOURLY_RATES;
