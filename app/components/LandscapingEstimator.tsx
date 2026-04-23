import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

// Hoisted to module scope so the useEffect below doesn't need it as a dep
// (a value re-created every render would make the effect run every render).
const PROPERTY_COMPLEXITIES = {
  industrial: 1.0,
  office: 1.0,
  hoa: 1.4,
  retail: 1.2,
  resort: 1.4,
} as const;

interface LandscapingEstimatorProps {
  propertyType?: string;
  onHoursUpdate?: (hours: number) => void;
  savedData?: any;
  onDataChange?: (data: any) => void;
}

const LandscapingEstimator: React.FC<LandscapingEstimatorProps> = ({
  propertyType: initialPropertyType = '',
  onHoursUpdate,
  savedData,
  onDataChange
}) => {

  type LandscapeFormData = {
    propertyType: string;
    onSite: boolean;
    mgtOnSite: boolean;
    complexityScore: number;
    plantDensity: number;
    graniteSF: string;
    turfSF: string;
    flowerSF: string;
    additionalItems: {
      palms: boolean;
      preEmergent: boolean;
      flowers: boolean;
      turfService: boolean;
    };
  };

  const [formData, setFormData] = useState<LandscapeFormData>(() => {
    if (savedData) {
      return savedData as LandscapeFormData;
    }
    return {
      propertyType: initialPropertyType,
      onSite: false,
      mgtOnSite: false,
      complexityScore: 1.0,
      plantDensity: 3,
      graniteSF: '',
      turfSF: '',
      flowerSF: '',
      additionalItems: {
        palms: false,
        preEmergent: false,
        flowers: false,
        turfService: false
      }
    };
  });

  // Update when props change
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      propertyType: initialPropertyType,
      complexityScore: initialPropertyType ? 
        (PROPERTY_COMPLEXITIES[initialPropertyType as keyof typeof PROPERTY_COMPLEXITIES] || 1.0) + (prev.mgtOnSite ? 0.1 : 0) 
        : prev.complexityScore
    }));
  }, [initialPropertyType]);

  // Keep the latest callbacks in refs so the effects below don't loop if the
  // parent ever passes inline callbacks (identity changes every render).
  const onDataChangeRef = useRef(onDataChange);
  const onHoursUpdateRef = useRef(onHoursUpdate);
  useEffect(() => {
    onDataChangeRef.current = onDataChange;
    onHoursUpdateRef.current = onHoursUpdate;
  }, [onDataChange, onHoursUpdate]);

  // Notify parent when form data changes
  useEffect(() => {
    onDataChangeRef.current?.(formData);
  }, [formData]);

  // Update parent when hours change
  useEffect(() => {
    const hours = parseFloat(calculateTotalHours());
    onHoursUpdateRef.current?.(hours);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.graniteSF,
    formData.turfSF,
    formData.flowerSF,
    formData.complexityScore,
    formData.plantDensity,
    formData.additionalItems.palms,
    formData.additionalItems.preEmergent,
    formData.additionalItems.flowers,
    formData.additionalItems.turfService
  ]);

  const getGraniteDivisor = (density: number) => {
    return 15000 - ((density - 3) * 3000);
  };

  // Helper function to format numbers with commas
  const formatNumberWithCommas = (value: string) => {
    const numberValue = value.replace(/,/g, '');
    if (!numberValue) return '';
    return parseInt(numberValue).toLocaleString('en-US');
  };

  // Helper function to get raw number from formatted string
  const getNumericValue = (value: string) => {
    return value.replace(/,/g, '');
  };

  const getBaseComplexity = () => {
    const industryDefault = formData.propertyType ? 
      (PROPERTY_COMPLEXITIES[formData.propertyType as keyof typeof PROPERTY_COMPLEXITIES] || 1.0) : 1.0;
    const onSiteAdjustment = formData.mgtOnSite ? 0.1 : 0;
    return industryDefault + onSiteAdjustment;
  };

  const getManualAdjustment = () => {
    const baseComplexity = getBaseComplexity();
    return formData.complexityScore - baseComplexity;
  };

  const handleInputChange = (field: string, value: any) => {
    // Handle square footage fields
    if (['graniteSF', 'turfSF', 'flowerSF'].includes(field)) {
      const numericValue = value.replace(/,/g, '');
      if (numericValue === '' || /^\d+$/.test(numericValue)) {
        setFormData(prev => ({
          ...prev,
          [field]: formatNumberWithCommas(numericValue)
        }));
      }
      return;
    }

    setFormData(prev => {
      // Handle property type change
      if (field === 'propertyType') {
        const baseComplexity = PROPERTY_COMPLEXITIES[value as keyof typeof PROPERTY_COMPLEXITIES] || 1.0;
        return {
          ...prev,
          [field]: value,
          complexityScore: baseComplexity + (prev.mgtOnSite ? 0.1 : 0)
        };
      }
      
      // Handle management on-site toggle
      if (field === 'mgtOnSite') {
        const baseComplexity = prev.propertyType ? 
          (PROPERTY_COMPLEXITIES[prev.propertyType as keyof typeof PROPERTY_COMPLEXITIES] || 1.0) : 1.0;
        return {
          ...prev,
          [field]: value,
          complexityScore: baseComplexity + (value ? 0.1 : 0)
        };
      }
      
      // Handle all other changes
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const calculateCategoryHours = (sqft: string, divisor?: number) => {
    const numericValue = getNumericValue(sqft || '0');
    if (divisor === undefined) {
      // For granite, use the dynamic divisor based on plant density
      divisor = getGraniteDivisor(formData.plantDensity);
    }
    return parseFloat(numericValue) / divisor;
  };

  const calculateTotalHours = () => {
    const graniteHours = calculateCategoryHours(formData.graniteSF);
    const turfHours = calculateCategoryHours(formData.turfSF, 7500);
    const flowerHours = calculateCategoryHours(formData.flowerSF, 20000);
    
    const baseHours = graniteHours + turfHours + flowerHours;
    let total = baseHours * formData.complexityScore;

    Object.values(formData.additionalItems).forEach((checked) => {
      if (checked) total += 1;
    });
    
    // Round to nearest 0.1
    return (Math.round(total * 10) / 10).toFixed(1);
  };

  return (
    <div className="w-full space-y-4">
      <Card className="overflow-hidden">
        <div className="bg-green-900 text-white py-2 px-3 sm:py-4 sm:px-6">
          <h3 className="text-lg sm:text-xl font-medium">Hours Estimator</h3>
        </div>
        <CardContent className="p-3 sm:p-4 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label>Property Type</Label>
                <Select 
                  value={formData.propertyType}
                  onValueChange={(value) => handleInputChange('propertyType', value)}
                  disabled={!!initialPropertyType}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="office">Office</SelectItem>
                    <SelectItem value="hoa">HOA</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="resort">Resort</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={formData.mgtOnSite}
                  onCheckedChange={(checked) => handleInputChange('mgtOnSite', checked)}
                />
                <Label>Is property management on-site?</Label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <Label className="flex items-baseline gap-2">
                  Plant Density
                  <span className="text-xs text-gray-500">
                    (1: sparse - 5: very dense)
                  </span>
                </Label>
                <div className="flex items-center gap-4 mt-1.5">
                  <Slider
                    value={[formData.plantDensity]}
                    onValueChange={(value) => handleInputChange('plantDensity', value[0])}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                  <span className="text-green-800 font-medium w-16">{formData.plantDensity}</span>
                </div>
                <div className="text-xs text-green-600 mt-1">
                  1 hour per {getGraniteDivisor(formData.plantDensity).toLocaleString()} sq ft
                </div>
              </div>

              <div>
                <Label className="flex items-baseline gap-2">
                  Granite Square Footage 
                  <span className="text-xs text-gray-500">
                    (1 hr per {getGraniteDivisor(formData.plantDensity).toLocaleString()} sq ft)
                  </span>
                </Label>
                <div className="flex gap-2 items-center mt-1.5">
                  <Input
                    type="text"
                    value={formData.graniteSF}
                    onChange={(e) => handleInputChange('graniteSF', e.target.value)}
                    placeholder="Enter Sq Ft"
                    className="max-w-[200px]"
                  />
                  <span className="text-green-600 whitespace-nowrap">
                    ({calculateCategoryHours(formData.graniteSF).toFixed(1)} hrs)
                  </span>
                </div>
              </div>
              
              <div>
                <Label className="flex items-baseline gap-2">
                  Turf Square Footage 
                  <span className="text-xs text-gray-500">(1 hr per 7,500 sq ft)</span>
                </Label>
                <div className="flex gap-2 items-center mt-1.5">
                  <Input
                    type="text"
                    value={formData.turfSF}
                    onChange={(e) => handleInputChange('turfSF', e.target.value)}
                    placeholder="Enter Sq Ft"
                    className="max-w-[200px]"
                  />
                  <span className="text-green-600 whitespace-nowrap">
                    ({calculateCategoryHours(formData.turfSF, 7500).toFixed(1)} hrs)
                  </span>
                </div>
              </div>
              
              <div>
                <Label className="flex items-baseline gap-2">
                  Flower Square Footage 
                  <span className="text-xs text-gray-500">(1 hr per 20,000 sq ft)</span>
                </Label>
                <div className="flex gap-2 items-center mt-1.5">
                  <Input
                    type="text"
                    value={formData.flowerSF}
                    onChange={(e) => handleInputChange('flowerSF', e.target.value)}
                    placeholder="Enter Sq Ft"
                    className="max-w-[200px]"
                  />
                  <span className="text-green-600 whitespace-nowrap">
                    ({calculateCategoryHours(formData.flowerSF, 20000).toFixed(1)} hrs)
                  </span>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t-2 border-green-200">
                <div className="bg-green-50 p-4 rounded-lg">
                  <Label className="text-green-900 font-semibold text-lg mb-2 block">Total Property - Serviced Square Footage</Label>
                  <div className="text-2xl font-bold text-green-800">
                    {(parseFloat(getNumericValue(formData.graniteSF) || '0') + 
                      parseFloat(getNumericValue(formData.turfSF) || '0') + 
                      parseFloat(getNumericValue(formData.flowerSF) || '0')).toLocaleString()} Sq Ft
                  </div>
                  <div className="text-sm text-green-600 mt-1">
                    Granite: {formData.graniteSF || '0'} Sq Ft • 
                    Turf: {formData.turfSF || '0'} Sq Ft • 
                    Flower: {formData.flowerSF || '0'} Sq Ft
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 mb-4">
              <div className="space-y-3 mb-4">
                <Label className="font-medium">Job Complexity Multiplier</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[formData.complexityScore]}
                    onValueChange={(value) => handleInputChange('complexityScore', value[0])}
                    min={0}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                  <span className="text-blue-800 font-medium w-16">{formData.complexityScore.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2 text-sm text-blue-600">
                {formData.propertyType && (
                  <div className="flex justify-between">
                    <span>Industry Default:</span>
                    <span className="font-medium">
                      {(PROPERTY_COMPLEXITIES[formData.propertyType as keyof typeof PROPERTY_COMPLEXITIES] || 1.0).toFixed(2)}
                    </span>
                  </div>
                )}
                {formData.mgtOnSite && (
                  <div className="flex justify-between">
                    <span>On-site Management Factor:</span>
                    <span className="font-medium">+0.10</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Base Complexity:</span>
                  <span className="font-medium">{getBaseComplexity().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Manual Complexity Adjustment:</span>
                  <span className="font-medium">{getManualAdjustment().toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Final Complexity:</span>
                  <span>{formData.complexityScore.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
              <div className="text-lg font-semibold text-green-800">
                Estimated Weekly Hours: {calculateTotalHours()} hrs
              </div>
              <div className="text-sm text-green-600 mt-1">
                Monthly Hours: {(parseFloat(calculateTotalHours()) * 4.33).toFixed(1)} hrs
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LandscapingEstimator;