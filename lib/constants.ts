export const HOURLY_RATES = {
  PHX: {
    MOBILE: 25,
    ONSITE: 28.50,
  },
  LV: {
    MOBILE: 23,
    ONSITE: 24.75,
  },
} as const;

export const WEEKS_PER_MONTH = 4.33;

export type Market = keyof typeof HOURLY_RATES;
