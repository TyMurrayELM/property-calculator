import { HOURLY_RATES, WEEKS_PER_MONTH, type Market } from './constants';

export interface HoursInput {
  weeklyHours: number;
  driveTimeHours: number;
  isOnsiteCrew: boolean;
  crewSize: number;
}

export interface PriceInput {
  monthlyPrice: number;
  driveTimeHours: number;
  isOnsiteCrew: boolean;
}

export function getHourlyRate(market: Market, isOnsite: boolean): number {
  return HOURLY_RATES[market][isOnsite ? 'ONSITE' : 'MOBILE'];
}

export function applyMargin(costPerMonth: number, marginPercent: number): number {
  return costPerMonth / (1 - marginPercent / 100);
}

/**
 * Hours → Price: given weekly on-property hours, drive time, and crew,
 * return the monthly price at a target profit margin.
 */
export function calculateHoursToPrice(
  input: HoursInput,
  market: Market,
  marginPercent: number
) {
  const hourlyRate = getHourlyRate(market, input.isOnsiteCrew);
  const driveTime = input.driveTimeHours * (input.crewSize || 1);
  const totalHoursPerVisit = input.weeklyHours + driveTime;
  const totalHoursPerMonth = totalHoursPerVisit * WEEKS_PER_MONTH;
  const costPerMonth = totalHoursPerMonth * hourlyRate;
  const priceAtMargin = applyMargin(costPerMonth, marginPercent);

  return {
    driveTime,
    totalHoursPerVisit,
    totalHoursPerMonth,
    costPerMonth,
    priceAtMargin,
    pricePerHourAtMargin: priceAtMargin / totalHoursPerMonth,
  };
}

/**
 * Price → Hours: given a monthly price, back out the hours budget at a target margin.
 * Drive time is NOT multiplied by crew size here (historic behavior of the Price→Hours side).
 */
export function calculatePriceToHours(
  input: PriceInput,
  market: Market,
  marginPercent: number
) {
  const hourlyRate = getHourlyRate(market, input.isOnsiteCrew);
  const costPerMonth = input.monthlyPrice * (1 - marginPercent / 100);
  const totalHoursPerMonth = costPerMonth / hourlyRate;
  const totalHoursPerWeek = totalHoursPerMonth / WEEKS_PER_MONTH;
  const driveTime = input.driveTimeHours;
  const onPropertyHours = totalHoursPerWeek - driveTime;
  const pricePerHour = input.monthlyPrice / totalHoursPerMonth;

  return {
    costPerMonth,
    totalHoursPerMonth,
    totalHoursPerWeek,
    driveTime,
    onPropertyHours,
    pricePerHour,
  };
}

/**
 * Initial Price→Hours drive time: 15% of on-property time, anchored to a
 * $2,000 monthly / 55% margin default. Used to seed the Price→Hours form.
 */
export function initialPriceDriveTime(market: Market): number {
  const hourlyRate = getHourlyRate(market, false);
  const costPerMonth = 2000 * (1 - 0.55);
  const totalHoursPerMonth = costPerMonth / hourlyRate;
  const totalHoursPerWeek = totalHoursPerMonth / WEEKS_PER_MONTH;
  const driveTimeHours = 0.15 * (totalHoursPerWeek / 1.15);
  return Math.round(driveTimeHours * 10) / 10;
}

/**
 * Shape of a saved property that's relevant to monthly-price calculation.
 * Kept structural so pricing.ts doesn't depend on the Property type that
 * lives in PropertyCalculator.tsx.
 */
interface MonthlyPriceSource {
  market?: Market | null;
  maintenanceData?: {
    hoursInput?: HoursInput;
    priceInput?: { monthlyPrice?: number };
    sliderMargin?: number;
  } | null;
}

/**
 * Monthly price for a saved property — prefers the Hours→Price derivation
 * when `hoursInput` is available, falls back to the raw Price→Hours input
 * otherwise. Used by the Properties Table and the Revenue Summary.
 */
export function propertyMonthlyPrice(property: MonthlyPriceSource): number {
  const market: Market = property.market || 'PHX';
  const maint = property.maintenanceData;
  if (maint?.hoursInput) {
    const margin = maint.sliderMargin ?? 55;
    return calculateHoursToPrice(maint.hoursInput, market, margin).priceAtMargin;
  }
  return maint?.priceInput?.monthlyPrice ?? 0;
}
