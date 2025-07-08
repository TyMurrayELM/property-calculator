import React, { useState, useEffect } from 'react';
import { Info, Target, CheckCircle, AlertCircle, XCircle, TreePine, Navigation, Plus, Minus } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MaintenanceCalculatorProps {
  selectedMarket: 'PHX' | 'LV';
  landscapeHours?: number;
  selectedBranch?: string;
  calculatedDriveTime?: number | null;
  savedData?: any;
  onDataChange?: (data: any) => void;
}

const MaintenanceCalculator: React.FC<MaintenanceCalculatorProps> = ({ 
  selectedMarket: initialMarket = 'PHX',
  landscapeHours = 0,
  selectedBranch,
  calculatedDriveTime,
  savedData,
  onDataChange
}) => {
  // Constants
  const HOURLY_RATES = {
    PHX: {
      MOBILE: 25,
      ONSITE: 28.50
    },
    LV: {
      MOBILE: 23,
      ONSITE: 24.75
    }
  };
  const WEEKS_PER_MONTH = 4.33;
  
  // State management
  const [selectedMarket, setSelectedMarket] = useState(
    savedData?.selectedMarket || initialMarket
  );
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  
  // Calculate initial drive time for Price to Hours based on 15% of on-property time
  const calculateInitialPriceDriveTime = () => {
    const hourlyRate = HOURLY_RATES['PHX']['MOBILE'];
    const costPerMonth = 2000 * (1 - 0.55);
    const totalHoursPerMonth = costPerMonth / hourlyRate;
    const totalHoursPerWeek = totalHoursPerMonth / WEEKS_PER_MONTH;
    const driveTimeHours = 0.15 * (totalHoursPerWeek / 1.15);
    return Math.round(driveTimeHours * 10) / 10;
  };

  // IMPORTANT: Saved drive time takes precedence over calculated drive time
  // This allows users to manually adjust drive time based on local knowledge
  // (e.g., multiple properties nearby, traffic patterns, etc.)

  const [hoursInput, setHoursInput] = useState(() => {
    if (savedData?.hoursInput) {
      // Use saved drive time if it exists, ensure crew size defaults to 1
      console.log('Loading saved hoursInput:', savedData.hoursInput);
      return {
        ...savedData.hoursInput,
        crewSize: savedData.hoursInput.crewSize || 1
      };
    }
    // For new properties, use calculated drive time if available
    return {
      weeklyHours: landscapeHours || 9,
      driveTimeHours: calculatedDriveTime !== null && calculatedDriveTime !== undefined ? calculatedDriveTime : (landscapeHours || 9) * 0.15,
      isOnsiteCrew: false,
      crewSize: 1
    };
  });

  const [priceInput, setPriceInput] = useState(() => {
    if (savedData?.priceInput) {
      // Use saved price input data including drive time
      return savedData.priceInput;
    }
    // For new properties, calculate default drive time
    return {
      monthlyPrice: 2000,
      driveTimeHours: calculateInitialPriceDriveTime(),
      isOnsiteCrew: false
    };
  });
  
  const [sliderMargin, setSliderMargin] = useState(
    savedData?.sliderMargin || 55
  );
  const [priceSliderMargin, setPriceSliderMargin] = useState(
    savedData?.priceSliderMargin || 55
  );

  // Notify parent when data changes
  useEffect(() => {
    if (onDataChange) {
      const dataToSave = {
        selectedMarket,
        hoursInput,
        priceInput,
        sliderMargin,
        priceSliderMargin
      };
      console.log('MaintenanceCalculator sending data:', dataToSave);
      onDataChange(dataToSave);
    }
  }, [selectedMarket, hoursInput, priceInput, sliderMargin, priceSliderMargin, onDataChange]);

  // Update when landscape hours change
  useEffect(() => {
    if (landscapeHours > 0) {
      setHoursInput(prev => ({
        ...prev,
        weeklyHours: landscapeHours,
        // Always preserve existing drive time (whether saved or manually adjusted)
        driveTimeHours: prev.isOnsiteCrew ? 0 : prev.driveTimeHours
      }));
    }
  }, [landscapeHours]);

  // Only update drive time when it's a NEW property (no saved data) and calculated drive time is available
  useEffect(() => {
    // If we have saved data, never auto-update the drive time
    if (savedData) {
      console.log('Have saved data, not updating drive time');
      return;
    }
    
    // Skip if it's an onsite crew or no calculated drive time
    if (hoursInput.isOnsiteCrew || calculatedDriveTime === null || calculatedDriveTime === undefined) {
      return;
    }
    
    // Only update if the current drive time looks like the default 15% calculation
    const expectedDefault = hoursInput.weeklyHours * 0.15;
    const currentValue = hoursInput.driveTimeHours;
    const looksLikeDefault = Math.abs(currentValue - expectedDefault) < 0.01;
    
    if (looksLikeDefault) {
      console.log('Updating drive time from calculated:', calculatedDriveTime);
      setHoursInput(prev => ({
        ...prev,
        driveTimeHours: calculatedDriveTime
      }));
    }
  }, [calculatedDriveTime, savedData, hoursInput.isOnsiteCrew, hoursInput.weeklyHours, hoursInput.driveTimeHours]);

  // Update market when prop changes
  useEffect(() => {
    if (!savedData) {
      setSelectedMarket(initialMarket);
    }
  }, [initialMarket, savedData]);

  // Toggle Switch Component
  const ToggleSwitch = ({ isChecked, onChange, leftLabel, rightLabel }: any) => (
    <div className="flex items-center justify-center gap-3 py-2">
      <span className={`text-sm ${!isChecked ? 'font-medium' : ''}`}>{leftLabel}</span>
      <div className="relative inline-block w-12 h-6 cursor-pointer" onClick={(e) => onChange({ target: { checked: !isChecked } })}>
        <div className={`block w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${isChecked ? 'bg-blue-900' : 'bg-gray-300'}`}>
          <div 
            className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out transform ${
              isChecked ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </div>
      </div>
      <span className={`text-sm ${isChecked ? 'font-medium' : ''}`}>{rightLabel}</span>
    </div>
  );

  // InfoTooltip Component for mobile-friendly tooltips
  const InfoTooltip = ({ id, content }: { id: string; content: string }) => (
    <Tooltip open={activeTooltip === id}>
      <TooltipTrigger asChild>
        <button 
          type="button" 
          className="focus:outline-none"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActiveTooltip(activeTooltip === id ? null : id);
          }}
        >
          <Info className="h-4 w-4 text-gray-500" />
        </button>
      </TooltipTrigger>
      <TooltipContent 
        className="max-w-[180px] z-50"
        onPointerDownOutside={(e) => {
          e.preventDefault();
          setActiveTooltip(null);
        }}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );

  // Handle crew type changes
  const handleHoursCrewChange = (isOnsite: boolean) => {
    setHoursInput(prev => {
      if (isOnsite) {
        return {
          ...prev,
          isOnsiteCrew: true,
          driveTimeHours: 0,
          weeklyHours: 40,
          crewSize: 1
        };
      } else {
        const weeklyHours = prev.weeklyHours === 40 ? (landscapeHours || 9) : prev.weeklyHours;
        // When switching back to mobile, preserve the existing drive time
        // Don't recalculate or reset it
        return {
          ...prev,
          isOnsiteCrew: false,
          weeklyHours: weeklyHours,
          crewSize: prev.crewSize || 1
          // driveTimeHours remains unchanged - it keeps its current value
        };
      }
    });
  };

  const handlePriceCrewChange = (isOnsite: boolean) => {
    setPriceInput(prev => {
      if (!isOnsite) {
        const hourlyRate = getHourlyRate(false);
        const costPerMonth = prev.monthlyPrice * (1 - (priceSliderMargin / 100));
        const totalHoursPerMonth = costPerMonth / hourlyRate;
        const totalHoursPerWeek = totalHoursPerMonth / WEEKS_PER_MONTH;
        const driveTimeHours = 0.15 * (totalHoursPerWeek / 1.15);
        return {
          ...prev,
          isOnsiteCrew: isOnsite,
          driveTimeHours: Math.round(driveTimeHours * 10) / 10
        };
      }
      return {
        ...prev,
        isOnsiteCrew: isOnsite,
        driveTimeHours: 0
      };
    });
  };

  // Calculate hourly rate based on crew type and region
  const getHourlyRate = (isOnsite: boolean) => {
    const market = HOURLY_RATES[selectedMarket];
    return isOnsite ? market.ONSITE : market.MOBILE;
  };

  // Helper function to get the appropriate icon for direct labor percentage
  const getDirectLaborIcon = (laborPercent: number) => {
    if (laborPercent <= 40) {
      return <CheckCircle className="h-4 w-4 text-green-500 ml-1" />;
    } else if (laborPercent <= 45) {
      return <AlertCircle className="h-4 w-4 text-yellow-500 ml-1" />;
    } else {
      return <XCircle className="h-4 w-4 text-red-500 ml-1" />;
    }
  };

  // Color interpolation function
  const getGradientColor = (value: number) => {
    const colors = [
      { percent: 40, color: [255, 165, 0] },  // Orange
      { percent: 50, color: [255, 255, 0] },  // Yellow
      { percent: 60, color: [0, 255, 0] }     // Green
    ];
    
    if (value <= colors[0].percent) {
      return `rgba(${colors[0].color.join(',')}, 0.3)`;
    } else if (value >= colors[colors.length - 1].percent) {
      return `rgba(${colors[colors.length - 1].color.join(',')}, 0.3)`;
    }
    
    for (let i = 0; i < colors.length - 1; i++) {
      if (value >= colors[i].percent && value <= colors[i + 1].percent) {
        const startColor = colors[i].color;
        const endColor = colors[i + 1].color;
        const startPercent = colors[i].percent;
        const endPercent = colors[i + 1].percent;
        
        const factor = (value - startPercent) / (endPercent - startPercent);
        
        const r = Math.round(startColor[0] + factor * (endColor[0] - startColor[0]));
        const g = Math.round(startColor[1] + factor * (endColor[1] - startColor[1]));
        const b = Math.round(startColor[2] + factor * (endColor[2] - startColor[2]));
        
        return `rgba(${r}, ${g}, ${b}, 0.3)`;
      }
    }
    return 'rgba(0, 255, 0, 0.3)';
  };

  // Calculate percentage for display
  const calculateDriveTimePercentage = () => {
    if (hoursInput.weeklyHours === 0) return 0;
    return Math.round((hoursInput.driveTimeHours / hoursInput.weeklyHours) * 100);
  };

  // Hours to Price Calculations
  const calculateHoursToPrice = () => {
    const hourlyRate = getHourlyRate(hoursInput.isOnsiteCrew);
    const driveTime = hoursInput.driveTimeHours * (hoursInput.crewSize || 1);
    const totalHoursPerVisit = hoursInput.weeklyHours + driveTime;
    const totalHoursPerMonth = totalHoursPerVisit * WEEKS_PER_MONTH;
    const costPerMonth = totalHoursPerMonth * hourlyRate;
    const priceAtSliderMargin = costPerMonth / (1 - (sliderMargin / 100));
    const priceAt60Margin = costPerMonth / (1 - 0.6);

    const pricePerHourAtSliderMargin = priceAtSliderMargin / totalHoursPerMonth;
    const pricePerHourAt60Margin = priceAt60Margin / totalHoursPerMonth;

    return {
      driveTime,
      totalHoursPerVisit,
      totalHoursPerMonth,
      costPerMonth,
      priceAtSliderMargin,
      priceAt60Margin,
      pricePerHourAtSliderMargin,
      pricePerHourAt60Margin
    };
  };

  // Price to Hours Calculations (NO CREW SIZE)
  const calculatePriceToHours = () => {
    const hourlyRate = getHourlyRate(priceInput.isOnsiteCrew);
    const costPerMonth = priceInput.monthlyPrice * (1 - (priceSliderMargin / 100));
    const totalHoursPerMonth = costPerMonth / hourlyRate;
    const totalHoursPerWeek = totalHoursPerMonth / WEEKS_PER_MONTH;
    const driveTime = priceInput.driveTimeHours; // No crew size multiplication
    const onPropertyHours = totalHoursPerWeek - driveTime;
    const pricePerHour = priceInput.monthlyPrice / totalHoursPerMonth;
    
    return {
      costPerMonth,
      totalHoursPerMonth,
      totalHoursPerWeek,
      driveTime,
      onPropertyHours,
      pricePerHour
    };
  };

  const results1 = calculateHoursToPrice();
  const results2 = calculatePriceToHours();

  // Calculate percentage for Price to Hours display
  const calculatePriceDriveTimePercentage = () => {
    if (results2.onPropertyHours <= 0) return 0;
    return Math.round((priceInput.driveTimeHours / results2.onPropertyHours) * 100);
  };

  // Crew size adjuster component
  const CrewSizeAdjuster = () => (
    <div className="absolute right-2 top-1 flex items-center bg-white rounded px-1">
      <button
        type="button"
        onClick={() => setHoursInput(prev => ({ ...prev, crewSize: Math.max(1, prev.crewSize - 1) }))}
        disabled={hoursInput.isOnsiteCrew || hoursInput.crewSize <= 1}
        className="p-1 text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="text-xs px-1 text-gray-700 min-w-[20px] text-center">{hoursInput.crewSize}</span>
      <button
        type="button"
        onClick={() => setHoursInput(prev => ({ ...prev, crewSize: prev.crewSize + 1 }))}
        disabled={hoursInput.isOnsiteCrew}
        className="p-1 text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Landscape Hours Integration Alert */}
        {landscapeHours > 0 && (
          <Alert className="border-green-200 bg-green-50">
            <TreePine className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Using {landscapeHours.toFixed(1)} weekly hours from hours estimate
              {calculatedDriveTime !== null && calculatedDriveTime !== undefined && (
                <span className="block text-sm mt-1">
                  Drive time: {calculatedDriveTime} hrs (per crew member)
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Hours to Price Calculator */}
        <Card className="overflow-hidden">
          <div className="bg-blue-900 text-white py-2 px-3 sm:py-4 sm:px-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg sm:text-xl font-medium">Hours → Price</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedMarket('PHX')}
                  className={`px-4 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${
                    selectedMarket === 'PHX' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-white hover:bg-orange-50 text-blue-900'
                  }`}
                >
                  Phoenix
                </button>
                <button
                  onClick={() => setSelectedMarket('LV')}
                  className={`px-4 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${
                    selectedMarket === 'LV' 
                      ? 'bg-yellow-600 text-white' 
                      : 'bg-white hover:bg-yellow-50 text-blue-900'
                  }`}
                >
                  Las Vegas
                </button>
              </div>
            </div>
          </div>
          <ToggleSwitch 
            isChecked={hoursInput.isOnsiteCrew}
            onChange={(e: any) => handleHoursCrewChange(e.target.checked)}
            leftLabel="Mobile Crew"
            rightLabel="Onsite Crew"
          />
          <div className="space-y-4 p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Weekly Hours On-Property
                </label>
                <input
                  type="number"
                  value={hoursInput.weeklyHours || ''}
                  onChange={(e) => setHoursInput({
                    ...hoursInput,
                    weeklyHours: parseFloat(e.target.value) || 0
                  })}
                  className="w-full p-2 border rounded bg-yellow-100 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                {landscapeHours > 0 && (
                  <p className="text-xs text-green-600 mt-1 text-center">
                    From hours estimate
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  Drive-Time / Logistical Hours
                  <InfoTooltip 
                    id="hours-drive-time"
                    content="Drive time is the travel time to/from property. This is in addition to the On-Property hours. On average, this runs 15% of On-Property time."
                  />
                  {hoursInput.crewSize > 1 && <span className="text-xs text-gray-500">(per crew member)</span>}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={hoursInput.driveTimeHours ? hoursInput.driveTimeHours.toFixed(1) : ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      setHoursInput({
                        ...hoursInput,
                        driveTimeHours: Math.max(0, value)
                      });
                    }}
                    disabled={hoursInput.isOnsiteCrew}
                    className={`w-full p-2 pr-20 border rounded text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      hoursInput.isOnsiteCrew ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100'
                    }`}
                  />
                  <CrewSizeAdjuster />
                </div>
                <div className="text-xs text-gray-500 mt-1 text-center">
                  ({calculateDriveTimePercentage()}% of on-property time)
                  {calculatedDriveTime !== null && calculatedDriveTime !== undefined && (
                    <span className="block text-green-600 font-medium">
                      {Math.abs(hoursInput.driveTimeHours - calculatedDriveTime) > 0.1
                        ? 'Using manually adjusted drive time'
                        : 'Using calculated drive time'}
                    </span>
                  )}
                  {hoursInput.crewSize > 1 && (
                    <span className="block text-blue-600 font-medium">
                      Total crew drive time: {(hoursInput.driveTimeHours * hoursInput.crewSize).toFixed(1)} hrs
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Drive Time/Visit{hoursInput.crewSize > 1 && ' (total)'}:</span>
                <span className="font-bold">{results1.driveTime.toFixed(1)} hrs</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Total Hours/Visit:</span>
                <span className="font-bold">{results1.totalHoursPerVisit.toFixed(1)} hrs</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Total Hours/Month:</span>
                <span className="font-bold">{results1.totalHoursPerMonth.toFixed(1)} hrs</span>
              </div>
              <div className="grid grid-cols-2 gap-2 bg-red-100 p-2 rounded text-sm">
                <span>Cost/Month</span>
                <span className="font-bold">
                  ${results1.costPerMonth.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  <span className="text-gray-600 text-xs ml-1">
                    (${getHourlyRate(hoursInput.isOnsiteCrew)}/hr)
                  </span>
                </span>
              </div>
              
              <div className="space-y-2 bg-blue-50 p-2 sm:p-3 rounded">
                <div className="flex justify-between items-center text-sm">
                  <span>Profit Margin:</span>
                  <span className="font-bold">{sliderMargin}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="65"
                  value={sliderMargin}
                  onChange={(e) => setSliderMargin(parseInt(e.target.value))}
                  className="w-full"
                />
                <div 
                  style={{
                    backgroundColor: getGradientColor(sliderMargin)
                  }}
                  className="grid grid-cols-3 gap-2 p-2 rounded text-sm"
                >
                  <span>Price at {sliderMargin}%</span>
                  <span className="font-bold">
                    ${results1.priceAtSliderMargin.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-right text-gray-600">
                    (${results1.pricePerHourAtSliderMargin.toFixed(2)}/hr)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 p-2 rounded text-sm">
                  <span>Direct Labor %</span>
                  <span className="font-bold flex items-center">
                    {100 - sliderMargin}%
                    {getDirectLaborIcon(100 - sliderMargin)}
                  </span>
                  <span className="text-right flex items-center justify-end text-gray-600">
                    <Target className="h-4 w-4 text-red-500" />  40%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-green-100 p-2 rounded text-sm">
                <span>Price at 60%</span>
                <span className="font-bold">
                  ${results1.priceAt60Margin.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-right text-gray-600">
                  (${results1.pricePerHourAt60Margin.toFixed(2)}/hr)
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Price to Hours Calculator */}
        <Card className="overflow-hidden">
          <div className="bg-blue-900 text-white py-2 px-3 sm:py-4 sm:px-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg sm:text-xl font-medium">Price → Hours</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedMarket('PHX')}
                  className={`px-4 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${
                    selectedMarket === 'PHX' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-white hover:bg-orange-50 text-blue-900'
                  }`}
                >
                  Phoenix
                </button>
                <button
                  onClick={() => setSelectedMarket('LV')}
                  className={`px-4 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${
                    selectedMarket === 'LV' 
                      ? 'bg-yellow-600 text-white' 
                      : 'bg-white hover:bg-yellow-50 text-blue-900'
                  }`}
                >
                  Las Vegas
                </button>
              </div>
            </div>
          </div>
          <ToggleSwitch 
            isChecked={priceInput.isOnsiteCrew}
            onChange={(e: any) => handlePriceCrewChange(e.target.checked)}
            leftLabel="Mobile Crew"
            rightLabel="Onsite Crew"
          />
          <div className="space-y-4 p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Monthly Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2">$</span>
                  <input
                    type="text"
                    value={`${priceInput.monthlyPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setPriceInput({
                        ...priceInput,
                        monthlyPrice: parseInt(value) || 0
                      });
                    }}
                    className="w-full p-2 pl-8 border rounded bg-yellow-100 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  Drive-Time / Logistical Hours
                  <InfoTooltip 
                    id="price-drive-time"
                    content="Drive time is the travel time to/from property. This is in addition to the On-Property hours. On average, this runs 15% of On-Property time."
                  />
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={priceInput.driveTimeHours || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      setPriceInput({
                        ...priceInput,
                        driveTimeHours: Math.max(0, value)
                      });
                    }}
                    disabled={priceInput.isOnsiteCrew}
                    className={`w-full p-2 border rounded text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      priceInput.isOnsiteCrew ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100'
                    }`}
                  />
                  <span className="absolute right-3 top-2 text-gray-600">hrs</span>
                </div>
                <div className="text-xs text-gray-500 mt-1 text-center">
                  ({calculatePriceDriveTimePercentage()}% of on-property time)
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="space-y-2 bg-blue-50 p-2 sm:p-3 rounded mb-4">
                <div className="flex justify-between items-center text-sm">
                  <span>Profit Margin</span>
                  <span className="font-bold">{priceSliderMargin}%</span>
                </div>
                <input
                  type="range"
                  min="35"
                  max="65"
                  value={priceSliderMargin}
                  onChange={(e) => setPriceSliderMargin(parseInt(e.target.value))}
                  className="w-full"
                />
                <div 
                  style={{
                    backgroundColor: getGradientColor(priceSliderMargin)
                  }}
                  className="grid grid-cols-2 gap-2 p-2 rounded text-sm"
                >
                  <span>Cost at {priceSliderMargin}%</span>
                  <span className="font-bold">
                    ${results2.costPerMonth.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2 rounded text-sm">
                  <span>Direct Labor %</span>
                  <span className="font-bold flex items-center">
                    {100 - priceSliderMargin}%
                    {getDirectLaborIcon(100 - priceSliderMargin)}
                    <span className="text-gray-600 ml-2 flex items-center">
                      <Target className="h-4 w-4 text-red-500 mx-1" /> 40%
                    </span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Hours/Month</span>
                <span className="font-bold">{results2.totalHoursPerMonth.toFixed(1)} hrs</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Hours/Week</span>
                <span className="font-bold">
                  {results2.totalHoursPerWeek.toFixed(1)} hrs
                  <span className="text-gray-600 ml-2">
                    (${results2.pricePerHour.toFixed(2)}/hr)
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Drive Time/Week</span>
                <span className="font-bold">{results2.driveTime.toFixed(1)} hrs</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>On-Property Hrs/Week</span>
                <span className="font-bold">{results2.onPropertyHours.toFixed(1)} hrs</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default MaintenanceCalculator;