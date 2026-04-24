import { describe, it, expect } from 'vitest';
import { HOURLY_RATES, WEEKS_PER_MONTH } from './constants';
import {
  applyMargin,
  calculateHoursToPrice,
  calculatePriceToHours,
  getHourlyRate,
  initialPriceDriveTime,
  propertyMonthlyPrice,
} from './pricing';

describe('getHourlyRate', () => {
  it('returns the configured PHX rates', () => {
    expect(getHourlyRate('PHX', false)).toBe(HOURLY_RATES.PHX.MOBILE);
    expect(getHourlyRate('PHX', true)).toBe(HOURLY_RATES.PHX.ONSITE);
  });
  it('returns the configured LV rates', () => {
    expect(getHourlyRate('LV', false)).toBe(HOURLY_RATES.LV.MOBILE);
    expect(getHourlyRate('LV', true)).toBe(HOURLY_RATES.LV.ONSITE);
  });
});

describe('applyMargin', () => {
  it('reverses to cost when margin = 0', () => {
    expect(applyMargin(1000, 0)).toBe(1000);
  });
  it('doubles cost at 50% margin', () => {
    expect(applyMargin(1000, 50)).toBe(2000);
  });
  it('multiplies by ~2.222 at 55% margin', () => {
    expect(applyMargin(1000, 55)).toBeCloseTo(2222.22, 1);
  });
  it('multiplies by 2.5 at 60% margin', () => {
    expect(applyMargin(1000, 60)).toBeCloseTo(2500, 5);
  });
});

describe('calculateHoursToPrice', () => {
  it('computes the full pipeline for PHX mobile crew', () => {
    const result = calculateHoursToPrice(
      { weeklyHours: 10, driveTimeHours: 2, isOnsiteCrew: false, crewSize: 1 },
      'PHX',
      55
    );
    const rate = HOURLY_RATES.PHX.MOBILE;
    const expectedTotalHoursPerMonth = (10 + 2) * WEEKS_PER_MONTH;
    const expectedCost = expectedTotalHoursPerMonth * rate;

    expect(result.driveTime).toBe(2);
    expect(result.totalHoursPerVisit).toBe(12);
    expect(result.totalHoursPerMonth).toBeCloseTo(expectedTotalHoursPerMonth, 5);
    expect(result.costPerMonth).toBeCloseTo(expectedCost, 5);
    expect(result.priceAtMargin).toBeCloseTo(expectedCost / (1 - 0.55), 5);
    expect(result.pricePerHourAtMargin).toBeCloseTo(result.priceAtMargin / result.totalHoursPerMonth, 5);
  });

  it('multiplies drive time by crew size', () => {
    const result = calculateHoursToPrice(
      { weeklyHours: 10, driveTimeHours: 2, isOnsiteCrew: false, crewSize: 3 },
      'PHX',
      55
    );
    expect(result.driveTime).toBe(6);
    expect(result.totalHoursPerVisit).toBe(16);
  });

  it('falls back to crewSize=1 when zero is passed (defensive)', () => {
    const result = calculateHoursToPrice(
      { weeklyHours: 10, driveTimeHours: 2, isOnsiteCrew: false, crewSize: 0 },
      'PHX',
      55
    );
    expect(result.driveTime).toBe(2);
  });

  it('uses the onsite rate when isOnsiteCrew=true', () => {
    const mobile = calculateHoursToPrice(
      { weeklyHours: 10, driveTimeHours: 0, isOnsiteCrew: false, crewSize: 1 },
      'PHX',
      55
    );
    const onsite = calculateHoursToPrice(
      { weeklyHours: 10, driveTimeHours: 0, isOnsiteCrew: true, crewSize: 1 },
      'PHX',
      55
    );
    expect(onsite.costPerMonth).toBeGreaterThan(mobile.costPerMonth);
    expect(onsite.costPerMonth / mobile.costPerMonth).toBeCloseTo(
      HOURLY_RATES.PHX.ONSITE / HOURLY_RATES.PHX.MOBILE,
      5
    );
  });

  it('uses the LV rate table when market=LV', () => {
    const result = calculateHoursToPrice(
      { weeklyHours: 10, driveTimeHours: 2, isOnsiteCrew: false, crewSize: 1 },
      'LV',
      55
    );
    expect(result.costPerMonth).toBeCloseTo(12 * WEEKS_PER_MONTH * HOURLY_RATES.LV.MOBILE, 5);
  });
});

describe('calculatePriceToHours', () => {
  it('backs out hours for PHX mobile, $3000/mo at 55% margin', () => {
    const result = calculatePriceToHours(
      { monthlyPrice: 3000, driveTimeHours: 1.5, isOnsiteCrew: false },
      'PHX',
      55
    );
    const expectedCost = 3000 * (1 - 0.55);
    const expectedTotalHoursPerMonth = expectedCost / HOURLY_RATES.PHX.MOBILE;
    const expectedTotalHoursPerWeek = expectedTotalHoursPerMonth / WEEKS_PER_MONTH;

    expect(result.costPerMonth).toBeCloseTo(expectedCost, 5);
    expect(result.totalHoursPerMonth).toBeCloseTo(expectedTotalHoursPerMonth, 5);
    expect(result.totalHoursPerWeek).toBeCloseTo(expectedTotalHoursPerWeek, 5);
    expect(result.driveTime).toBe(1.5);
    expect(result.onPropertyHours).toBeCloseTo(expectedTotalHoursPerWeek - 1.5, 5);
    expect(result.pricePerHour).toBeCloseTo(3000 / expectedTotalHoursPerMonth, 5);
  });

  it('does NOT multiply drive time by crew size (PriceInput has none)', () => {
    const result = calculatePriceToHours(
      { monthlyPrice: 3000, driveTimeHours: 5, isOnsiteCrew: false },
      'PHX',
      55
    );
    expect(result.driveTime).toBe(5);
  });

  it('round-trips with calculateHoursToPrice for compatible inputs', () => {
    // Drive everything at the same crew=1 so the two paths agree
    const hours = { weeklyHours: 9.5, driveTimeHours: 1.4, isOnsiteCrew: false, crewSize: 1 };
    const margin = 55;

    const forward = calculateHoursToPrice(hours, 'PHX', margin);
    const back = calculatePriceToHours(
      { monthlyPrice: forward.priceAtMargin, driveTimeHours: hours.driveTimeHours, isOnsiteCrew: false },
      'PHX',
      margin
    );

    expect(back.totalHoursPerMonth).toBeCloseTo(forward.totalHoursPerMonth, 5);
    expect(back.totalHoursPerWeek).toBeCloseTo(hours.weeklyHours + hours.driveTimeHours, 5);
    expect(back.onPropertyHours).toBeCloseTo(hours.weeklyHours, 5);
  });
});

describe('initialPriceDriveTime', () => {
  it('returns a positive value rounded to 0.1 for both markets', () => {
    for (const market of ['PHX', 'LV'] as const) {
      const result = initialPriceDriveTime(market);
      expect(result).toBeGreaterThan(0);
      expect(Math.round(result * 10) / 10).toBe(result);
    }
  });

  it('uses the MOBILE hourly rate, not ONSITE', () => {
    // Reconstruct what the formula should give with the MOBILE rate; assert match.
    const expected = (market: 'PHX' | 'LV') => {
      const cost = 2000 * (1 - 0.55);
      const totalMo = cost / HOURLY_RATES[market].MOBILE;
      const totalWk = totalMo / WEEKS_PER_MONTH;
      return Math.round((0.15 * (totalWk / 1.15)) * 10) / 10;
    };
    expect(initialPriceDriveTime('PHX')).toBe(expected('PHX'));
    expect(initialPriceDriveTime('LV')).toBe(expected('LV'));
  });
});

describe('propertyMonthlyPrice', () => {
  const baseHours = { weeklyHours: 10, driveTimeHours: 2, isOnsiteCrew: false, crewSize: 1 };

  it('uses calculateHoursToPrice when hoursInput is present', () => {
    const property = {
      market: 'PHX' as const,
      maintenanceData: { hoursInput: baseHours, sliderMargin: 55 },
    };
    const expected = calculateHoursToPrice(baseHours, 'PHX', 55).priceAtMargin;
    expect(propertyMonthlyPrice(property)).toBeCloseTo(expected, 5);
  });

  it('falls back to priceInput.monthlyPrice when hoursInput is missing', () => {
    expect(
      propertyMonthlyPrice({
        market: 'PHX',
        maintenanceData: { priceInput: { monthlyPrice: 1500 } },
      })
    ).toBe(1500);
  });

  it('returns 0 when no maintenance data exists', () => {
    expect(propertyMonthlyPrice({})).toBe(0);
    expect(propertyMonthlyPrice({ maintenanceData: {} })).toBe(0);
    expect(propertyMonthlyPrice({ maintenanceData: null })).toBe(0);
  });

  it('defaults market to PHX when missing', () => {
    const phx = propertyMonthlyPrice({
      market: 'PHX',
      maintenanceData: { hoursInput: baseHours, sliderMargin: 55 },
    });
    const noMarket = propertyMonthlyPrice({
      maintenanceData: { hoursInput: baseHours, sliderMargin: 55 },
    });
    expect(noMarket).toBe(phx);
  });

  it('defaults sliderMargin to 55 when missing', () => {
    const explicit = propertyMonthlyPrice({
      market: 'PHX',
      maintenanceData: { hoursInput: baseHours, sliderMargin: 55 },
    });
    const implicit = propertyMonthlyPrice({
      market: 'PHX',
      maintenanceData: { hoursInput: baseHours },
    });
    expect(implicit).toBe(explicit);
  });
});
