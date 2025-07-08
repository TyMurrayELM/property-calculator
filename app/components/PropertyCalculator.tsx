import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, FileDown, Building2, Calculator, TreePine, MapPin, Navigation, Loader2, CheckCircle, ChevronDown, ChevronUp, Map, Trash2, AlertCircle, Car, Table, Upload, Users } from 'lucide-react';
import MaintenanceCalculator from './MaintenanceCalculator';
import LandscapingEstimator from './LandscapingEstimator';
import dynamic from 'next/dynamic';
import { useProperties } from '@/hooks/useProperties';
import { useActiveProperties } from '@/hooks/useActiveProperties';

// Dynamically import RouteMap to avoid SSR issues
const RouteMap = dynamic(() => import('./RouteMap'), {
  ssr: false,
  loading: () => (
    <Card>
      <CardContent className="p-8 text-center text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
        Loading map...
      </CardContent>
    </Card>
  )
});

// Branch locations with coordinates
const BRANCHES = {
  PHX: {
    name: 'Phoenix',
    branches: [
      {
        id: 'phx-sw',
        name: 'Phoenix - SouthWest',
        address: '2600 S 20th Ave, Phoenix, AZ 85009',
        lat: 33.423938,
        lng: -112.102994,
        icon: 'https://i.imgur.com/mJFHdZk_d.png?maxwidth=520&shape=thumb&fidelity=high'
      },
      {
        id: 'phx-se',
        name: 'Phoenix - SouthEast',
        address: '1715 N Arizona Ave, Chandler, AZ 85225',
        lat: 33.3321053,
        lng: -111.8412433,
        icon: 'https://i.imgur.com/YsG3uVB_d.png?maxwidth=520&shape=thumb&fidelity=high'
      },
      {
        id: 'phx-n',
        name: 'Phoenix - North',
        address: '23325 N 23rd Avenue, Suite 160, Phoenix, AZ 85027',
        lat: 33.6971946,
        lng: -112.1053995,
        icon: 'https://i.imgur.com/GNxnJQN_d.png?maxwidth=520&shape=thumb&fidelity=high'
      }
    ]
  },
  LV: {
    name: 'Las Vegas',
    branches: [
      {
        id: 'lv-main',
        name: 'Las Vegas',
        address: '6290 S Pecos Rd, Las Vegas, NV 89120',
        lat: 36.0758681,
        lng: -115.1002532,
        icon: 'https://i.imgur.com/EZMUwop_d.png?maxwidth=520&shape=thumb&fidelity=high'
      }
    ]
  }
};

// Constants for calculations
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

export interface Property {
  id?: string;
  name: string;
  address?: string;
  type: string;
  market: 'PHX' | 'LV'; // Internal name kept as 'market' for compatibility
  branch?: string;
  landscapeData?: any;
  maintenanceData?: any;
  totalLandscapeHours?: number;
  calculatedDriveTime?: number | null;
  savedAt?: Date;
}

const PropertyCalculator = () => {
  const [currentProperty, setCurrentProperty] = useState<Property>({
    name: '',
    address: '',
    type: '',
    market: 'PHX',
    branch: 'phx-sw'
  });

  const [landscapeHours, setLandscapeHours] = useState<number>(0);
  const [landscapeFormData, setLandscapeFormData] = useState<any>(null);
  const [maintenanceFormData, setMaintenanceFormData] = useState<any>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [calculatedDriveTime, setCalculatedDriveTime] = useState<number | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [distanceError, setDistanceError] = useState<string>('');
  const [suggestedBranch, setSuggestedBranch] = useState<string>('');
  const [isMapExpanded, setIsMapExpanded] = useState(true);
  const [isPropertyInfoExpanded, setIsPropertyInfoExpanded] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);
  const [showPropertiesTable, setShowPropertiesTable] = useState(false);
  const [isFindingClosestBranch, setIsFindingClosestBranch] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [proximityData, setProximityData] = useState<{
    nearbyProperties: any[];
    proximityFactor: number;
    description: string;
    adjustedDriveTime: number | null;
  } | null>(null);

  // Use refs to prevent cascading updates
  const isUpdatingFromAddress = useRef(false);
  const addressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use Supabase hook
  const { properties: savedProperties, loading: propertiesLoading, saveProperty: saveToSupabase, deleteProperty: deleteFromSupabase } = useProperties();
  
  // Use Active Properties hook
  const { 
    activeProperties, 
    loading: activePropertiesLoading, 
    importProgress, 
    importProperties, 
    calculateProximity,
    totalCount: totalActiveProperties 
  } = useActiveProperties();

  // Get branches for selected region
  const getMarketBranches = () => {
    return BRANCHES[currentProperty.market].branches;
  };

  const handlePropertyChange = (field: keyof Property, value: any, skipDriveTimeCalc = false) => {
    setCurrentProperty(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // If region changes, set default branch for that region
      if (field === 'market') {
        updated.branch = BRANCHES[value as 'PHX' | 'LV'].branches[0].id;
        // Don't clear suggested branch - keep showing which is closest
      }
      
      return updated;
    });
    
    // Handle post-update actions - but skip if we're in the middle of an address update
    if (!skipDriveTimeCalc && !isUpdatingFromAddress.current) {
      if (field === 'market' && currentProperty.address) {
        // When region changes, recalculate for the new default branch
        const newBranch = BRANCHES[value as 'PHX' | 'LV'].branches[0].id;
        calculateDriveTime(currentProperty.address, newBranch);
      } else if (field === 'branch' && currentProperty.address) {
        // When branch changes directly, recalculate immediately
        calculateDriveTime(currentProperty.address, value);
      }
    }
  };

  const handleLandscapeHoursUpdate = (hours: number) => {
    setLandscapeHours(hours);
    setCurrentProperty(prev => ({
      ...prev,
      totalLandscapeHours: hours
    }));
  };

  const saveProperty = async () => {
    setIsSaving(true);
    try {
      const propertyToSave: Property = {
        ...currentProperty,
        id: currentProperty.id,
        savedAt: new Date(),
        totalLandscapeHours: landscapeHours,
        calculatedDriveTime: calculatedDriveTime,
        landscapeData: landscapeFormData,
        maintenanceData: maintenanceFormData
      };

      await saveToSupabase(propertyToSave);
      setShowSaveDialog(false);
    } catch (error) {
      console.error('Error saving property:', error);
      // You might want to show an error toast here
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProperty = async () => {
    if (!propertyToDelete) return;
    
    try {
      await deleteFromSupabase(propertyToDelete);
      setPropertyToDelete(null);
      setShowDeleteDialog(false);
      // Clear current property if it was the deleted one
      if (currentProperty.id === propertyToDelete) {
        setCurrentProperty({
          name: '',
          address: '',
          type: '',
          market: 'PHX',
          branch: 'phx-sw'
        });
        setLandscapeHours(0);
        setCalculatedDriveTime(null);
        setLandscapeFormData(null);
        setMaintenanceFormData(null);
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      // You might want to show an error toast here
    }
  };

  const loadProperty = (property: Property) => {
    setCurrentProperty(property);
    if (property.totalLandscapeHours) {
      setLandscapeHours(property.totalLandscapeHours);
    }
    
    // Restore form data
    if (property.landscapeData) {
      setLandscapeFormData(property.landscapeData);
    }
    if (property.maintenanceData) {
      setMaintenanceFormData(property.maintenanceData);
    }
    
    // Clear existing drive time and proximity data first to ensure map updates
    setCalculatedDriveTime(null);
    setProximityData(null);
    
    // Then recalculate drive time and find closest branch after a brief delay to ensure state has updated
    if (property.address && property.branch) {
      setTimeout(() => {
        calculateDriveTime(property.address, property.branch);
        // Also find the closest branch to show indicators (but don't update selection)
        findClosestBranch(property.address, false);
      }, 100);
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify({
      property: currentProperty,
      landscapeHours,
      calculatedDriveTime,
      landscapeFormData,
      maintenanceFormData,
      exportDate: new Date().toISOString()
    }, null, 2);
    
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `${currentProperty.name || 'property'}-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const getCurrentBranch = () => {
    const marketBranches = getMarketBranches();
    return marketBranches.find(b => b.id === currentProperty.branch);
  };

  // Calculate drive time from property to selected branch
  const calculateDriveTime = async (propertyAddress?: string, branchId?: string) => {
    const address = propertyAddress || currentProperty.address;
    const selectedBranchId = branchId || currentProperty.branch;
    
    if (!address || !selectedBranchId) return;
    
    setIsCalculatingDistance(true);
    setDistanceError('');
    
    try {
      const branch = [...BRANCHES.PHX.branches, ...BRANCHES.LV.branches].find(b => b.id === selectedBranchId);
      if (!branch) return;
      
      const response = await fetch('/api/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'geocode',
          data: { address }
        })
      });
      
      const geocodeResult = await response.json();
      
      if (!geocodeResult.success) {
        setDistanceError('Could not find property address');
        return;
      }
      
      // Calculate distance to selected branch
      const distanceResponse = await fetch('/api/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'distance',
          data: {
            origin: geocodeResult.location,
            destination: { lat: branch.lat, lng: branch.lng }
          }
        })
      });
      
      const distanceResult = await distanceResponse.json();
      
      if (distanceResult.success) {
        // Round to nearest 0.1 hour
        const driveTimeHours = Math.round(distanceResult.durationHours * 10) / 10;
        setCalculatedDriveTime(driveTimeHours);
        
        // Check for nearby properties if we have active properties
        if (totalActiveProperties > 0) {
          const proximityResult = await calculateProximity(
            geocodeResult.location.lat,
            geocodeResult.location.lng,
            selectedBranchId,
            1 // 1 mile radius
          );
          
          if (proximityResult) {
            const adjustedTime = Math.round(driveTimeHours * proximityResult.proximityFactor * 10) / 10;
            setProximityData({
              nearbyProperties: proximityResult.nearbyProperties,
              proximityFactor: proximityResult.proximityFactor,
              description: proximityResult.description,
              adjustedDriveTime: adjustedTime
            });
          }
        }
      } else {
        setDistanceError('Could not calculate distance');
      }
    } catch (error) {
      setDistanceError('Error calculating distance');
      console.error('Distance calculation error:', error);
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  // Find closest branch when address changes
  const findClosestBranch = async (addressToCheck?: string, isNewAddress: boolean = false) => {
    const address = addressToCheck || currentProperty.address;
    if (!address) return;
    
    setIsFindingClosestBranch(true);
    
    try {
      const response = await fetch('/api/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'findClosest',
          data: {
            address: address,
            branches: [...BRANCHES.PHX.branches, ...BRANCHES.LV.branches]
          }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('Setting suggested branch to:', result.closestBranch.id);
        setSuggestedBranch(result.closestBranch.id);
        
        // Update market/branch if it's a new address being typed (not when loading a property)
        if (isNewAddress) {
          console.log('Auto-selecting closest branch:', result.closestBranch.name);
          // Set flag to prevent cascading updates
          isUpdatingFromAddress.current = true;
          
          // Determine market based on closest branch
          const isPhoenixBranch = BRANCHES.PHX.branches.some(b => b.id === result.closestBranch.id);
          const newMarket = isPhoenixBranch ? 'PHX' : 'LV';
          
          // Update property with suggested branch and market
          handlePropertyChange('market', newMarket, true);
          handlePropertyChange('branch', result.closestBranch.id, true);
          
          // Set the calculated drive time
          const driveTimeHours = Math.round(result.durationHours * 10) / 10;
          setCalculatedDriveTime(driveTimeHours);
          
          // Reset flag after updates
          setTimeout(() => {
            isUpdatingFromAddress.current = false;
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error finding closest branch:', error);
    } finally {
      setIsFindingClosestBranch(false);
    }
  };

  const handleAddressChange = (value: string) => {
    handlePropertyChange('address', value, true);
    
    // Clear any existing errors
    setDistanceError('');
    
    // Only clear results if the address is being cleared/deleted
    if (value.length < 10) {
      setCalculatedDriveTime(null);
      setProximityData(null);
      // Don't clear suggestedBranch here - keep it to show the indicator
    }
    
    // Clear existing timeout
    if (addressTimeoutRef.current) {
      clearTimeout(addressTimeoutRef.current);
    }
    
    // Set new timeout for finding closest branch
    addressTimeoutRef.current = setTimeout(() => {
      if (value.length > 10) {
        findClosestBranch(value, true); // Pass the actual address value and true to indicate it's a new address
      }
    }, 2500); // Increased to 2.5 seconds
  };

  // Handle file import
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const result = await importProperties(file);
    
    if (result?.success) {
      setShowImportDialog(false);
      // Clear the file input
      event.target.value = '';
      
      // If we have a current address, recalculate with proximity
      if (currentProperty.address && currentProperty.branch) {
        calculateDriveTime(currentProperty.address, currentProperty.branch);
      }
    }
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (addressTimeoutRef.current) {
        clearTimeout(addressTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Building2 className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Maintenance Bid Calculator</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImportDialog(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Active Properties
                {totalActiveProperties > 0 && (
                  <span className="ml-2 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">
                    {totalActiveProperties}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPropertiesTable(true)}
                disabled={savedProperties.length === 0}
              >
                <Table className="h-4 w-4 mr-2" />
                View All ({savedProperties.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportData}
                disabled={!currentProperty.name}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!currentProperty.name}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Property
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Property</DialogTitle>
                    <DialogDescription>
                      Save the current property configuration for future use.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Property Name</Label>
                      <Input
                        value={currentProperty.name}
                        onChange={(e) => handlePropertyChange('name', e.target.value)}
                        placeholder="Enter property name"
                      />
                    </div>
                    <Button onClick={saveProperty} className="w-full" disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Property'
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Route Map - Collapsible */}
        {calculatedDriveTime !== null && currentProperty.address && getCurrentBranch() && (
          <Card className="mb-6">
            <CardHeader className="cursor-pointer" onClick={() => setIsMapExpanded(!isMapExpanded)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Map className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">Route Visualization</CardTitle>
                  <span className="text-sm text-gray-500">
                    {currentProperty.address} → {getCurrentBranch()?.name}
                  </span>
                </div>
                <Button variant="ghost" size="sm">
                  {isMapExpanded ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </CardHeader>
            {isMapExpanded && (
              <CardContent className="p-0">
                <RouteMap
                  key={`${currentProperty.address}-${currentProperty.branch}`}
                  propertyAddress={currentProperty.address}
                  branch={getCurrentBranch()!}
                  calculatedDriveTime={proximityData?.adjustedDriveTime || calculatedDriveTime}
                />
              </CardContent>
            )}
          </Card>
        )}

        {/* Property Info Bar */}
        <Card className="mb-6">
          <CardHeader className="cursor-pointer" onClick={() => setIsPropertyInfoExpanded(!isPropertyInfoExpanded)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Property Information</CardTitle>
                {!isPropertyInfoExpanded && currentProperty.name && (
                  <span className="text-sm text-gray-500 ml-2">
                    {currentProperty.name}
                    {currentProperty.type && ` • ${currentProperty.type}`}
                    {getCurrentBranch() && ` • ${getCurrentBranch()?.name}`}
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm">
                {isPropertyInfoExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </Button>
            </div>
          </CardHeader>
          {isPropertyInfoExpanded && (
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label>Property Name</Label>
                  <Input
                    value={currentProperty.name}
                    onChange={(e) => handlePropertyChange('name', e.target.value)}
                    placeholder="Enter property name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Property Type</Label>
                  <Select
                    value={currentProperty.type}
                    onValueChange={(value) => handlePropertyChange('type', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="office">Office</SelectItem>
                      <SelectItem value="hoa">HOA</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="industrial">Industrial</SelectItem>
                      <SelectItem value="resort">Resort</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Region</Label>
                  <Select
                    value={currentProperty.market}
                    onValueChange={(value) => handlePropertyChange('market', value as 'PHX' | 'LV')}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PHX">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2" />
                          Phoenix
                        </div>
                      </SelectItem>
                      <SelectItem value="LV">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2" />
                          Las Vegas
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    Branch
                    {suggestedBranch && currentProperty.branch === suggestedBranch && (
                      <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full flex items-center animate-pulse">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Closest Branch
                      </span>
                    )}
                  </Label>
                  <Select
                    value={currentProperty.branch}
                    onValueChange={(value) => handlePropertyChange('branch', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getMarketBranches().map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>
                          <div className={`flex items-center gap-2 ${suggestedBranch === branch.id ? 'font-medium' : ''}`}>
                            <img 
                              src={branch.icon} 
                              alt={branch.name} 
                              className="h-5 w-5 object-contain"
                              onError={(e) => {
                                // Fallback to Navigation icon if image fails
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                            <Navigation className="h-5 w-5 hidden" />
                            <span>{branch.name}</span>
                            {suggestedBranch === branch.id && (
                              <span className="ml-auto bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Closest Branch
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="lg:col-span-2">
                  <Label>Saved Properties</Label>
                  <div className="flex gap-2 mt-1">
                    <Select
                      value=""
                      onValueChange={(value) => {
                        const property = savedProperties.find(p => p.id === value);
                        if (property) loadProperty(property);
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={propertiesLoading ? "Loading..." : "Load property"} />
                      </SelectTrigger>
                      <SelectContent>
                        {savedProperties.map(property => (
                          <SelectItem key={property.id} value={property.id!}>
                            <div className="flex items-center justify-between w-full">
                              <span>{property.name}</span>
                              {property.savedAt && (
                                <span className="text-xs text-gray-500 ml-2">
                                  {new Date(property.savedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {currentProperty.id && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setPropertyToDelete(currentProperty.id!);
                          setShowDeleteDialog(true);
                        }}
                        title="Delete current property"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Address Input with Auto-calculation */}
              <div className="mt-4">
                <Label>Property Address</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={currentProperty.address}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    placeholder="Enter property address for automatic drive time calculation"
                    className="flex-1"
                  />
                  {(isCalculatingDistance || isFindingClosestBranch) && (
                    <div className="flex items-center text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {isFindingClosestBranch ? 'Finding closest branch...' : 'Calculating...'}
                    </div>
                  )}
                </div>
                {distanceError && (
                  <p className="text-sm text-red-500 mt-1">{distanceError}</p>
                )}
                {/* Success message when closest branch is found */}
                {suggestedBranch && currentProperty.branch === suggestedBranch && calculatedDriveTime !== null && !isCalculatingDistance && !isFindingClosestBranch && (
                  <Alert className="mt-2 border-green-500 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 font-medium">
                      ✓ Automatically selected the closest branch: {getCurrentBranch()?.name}
                    </AlertDescription>
                  </Alert>
                )}
                {calculatedDriveTime !== null && !isCalculatingDistance && !isFindingClosestBranch && (
                  <>
                    <Alert className="mt-2 border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        <div className="space-y-2">
                          <div>
                            <strong>Isolated drive time:</strong> {calculatedDriveTime} hrs (per crew member) from {getCurrentBranch()?.name}
                            {suggestedBranch && currentProperty.branch === suggestedBranch && (
                              <span className="ml-2 font-semibold">
                                <CheckCircle className="inline h-3 w-3 mr-1" />
                                This is the closest branch
                              </span>
                            )}
                          </div>
                          {proximityData && proximityData.proximityFactor < 1 && (
                            <div className="pt-2 border-t border-green-200">
                              <div className="flex items-center justify-between">
                                <div>
                                  <strong className="text-green-700">
                                    <Users className="inline h-4 w-4 mr-1" />
                                    Optimized drive time: {proximityData.adjustedDriveTime} hrs
                                  </strong>
                                  <div className="text-sm mt-1">
                                    {proximityData.description}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-2xl font-bold text-green-700">
                                    {Math.round((1 - proximityData.proximityFactor) * 100)}%
                                  </span>
                                  <div className="text-xs text-green-600">reduction</div>
                                </div>
                              </div>
                              {proximityData.nearbyProperties.length > 0 && (
                                <details className="mt-2">
                                  <summary className="text-sm cursor-pointer text-green-700 hover:text-green-800">
                                    View nearby properties ({proximityData.nearbyProperties.length})
                                  </summary>
                                  <div className="mt-2 space-y-1 text-sm">
                                    {proximityData.nearbyProperties.slice(0, 5).map((prop, idx) => (
                                      <div key={idx} className="flex justify-between text-gray-600">
                                        <span>{prop.name}</span>
                                        <span>{prop.distance} mi</span>
                                      </div>
                                    ))}
                                    {proximityData.nearbyProperties.length > 5 && (
                                      <div className="text-gray-500 italic">
                                        and {proximityData.nearbyProperties.length - 5} more...
                                      </div>
                                    )}
                                  </div>
                                </details>
                              )}
                            </div>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                    {suggestedBranch && currentProperty.branch !== suggestedBranch && suggestedBranch !== '' && (
                      <Alert className="mt-2 border-amber-200 bg-amber-50">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800">
                          <div className="flex items-center justify-between">
                            <div>
                              <strong>{[...BRANCHES.PHX.branches, ...BRANCHES.LV.branches].find(b => b.id === suggestedBranch)?.name}</strong> is the closest branch for this address.
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const suggestedBranchData = [...BRANCHES.PHX.branches, ...BRANCHES.LV.branches].find(b => b.id === suggestedBranch);
                                if (suggestedBranchData) {
                                  const isPhoenixBranch = BRANCHES.PHX.branches.some(b => b.id === suggestedBranch);
                                  const newMarket = isPhoenixBranch ? 'PHX' : 'LV';
                                  handlePropertyChange('market', newMarket);
                                  handlePropertyChange('branch', suggestedBranch);
                                }
                              }}
                              className="ml-2 text-amber-700 border-amber-300 hover:bg-amber-100"
                            >
                              Switch Branch
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Summary Cards */}
        {landscapeHours > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardContent className="p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TreePine className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-600">Estimated Weekly Hours</p>
                      <p className="text-xl font-bold text-green-600">
                        {landscapeHours.toFixed(1)} total hrs/week
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600">Monthly Hours</p>
                    <p className="text-lg font-semibold text-gray-800">
                      {(landscapeHours * 4.33).toFixed(1)} hrs
                    </p>
                  </div>
                </div>
                {maintenanceFormData?.hoursInput?.driveTimeHours !== undefined && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 flex items-center">
                        <Car className="h-3 w-3 mr-1" />
                        Drive time (Price Calculator)
                      </span>
                      <span className="font-semibold text-blue-600">
                        {maintenanceFormData.hoursInput.driveTimeHours.toFixed(1)} hrs
                        {maintenanceFormData.hoursInput.crewSize > 1 && (
                          <span className="text-gray-500 ml-1">× {maintenanceFormData.hoursInput.crewSize} crew</span>
                        )}
                      </span>
                    </div>
                    {proximityData && proximityData.proximityFactor < 1 && (
                      <div className="mt-1 text-xs text-green-700 font-medium text-right">
                        <Users className="inline h-3 w-3 mr-1" />
                        Based on optimized route
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {getCurrentBranch() && (
              <Card>
                <CardContent className="p-2.5">
                  <div className="flex items-center space-x-2">
                    <Navigation className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600">Service Branch</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800">
                          {getCurrentBranch()?.name}
                        </p>
                        {suggestedBranch && currentProperty.branch === suggestedBranch && (
                          <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full flex items-center animate-pulse">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Closest Branch
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {getCurrentBranch()?.address}
                      </p>
                      {calculatedDriveTime !== null && (
                        <div>
                          <p className="text-xs text-green-600 font-medium">
                            Drive time: {calculatedDriveTime} hrs (isolated)
                          </p>
                          {proximityData && proximityData.proximityFactor < 1 && (
                            <p className="text-xs text-green-700 font-bold">
                              <Users className="inline h-3 w-3 mr-1" />
                              Optimized: {proximityData.adjustedDriveTime} hrs
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Calculators Tabs */}
        <Tabs defaultValue="landscape" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger 
              value="landscape" 
              className="flex items-center gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=inactive]:bg-green-100 data-[state=inactive]:text-green-700 data-[state=inactive]:hover:bg-green-200"
            >
              <TreePine className="h-4 w-4" />
              Hours Estimator
            </TabsTrigger>
            <TabsTrigger 
              value="maintenance" 
              className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-blue-100 data-[state=inactive]:text-blue-700 data-[state=inactive]:hover:bg-blue-200"
            >
              <Calculator className="h-4 w-4" />
              Price Calculator
            </TabsTrigger>
          </TabsList>

          <TabsContent value="landscape" className="space-y-4">
            <LandscapingEstimator
              propertyType={currentProperty.type}
              onHoursUpdate={handleLandscapeHoursUpdate}
              savedData={landscapeFormData}
              onDataChange={setLandscapeFormData}
            />
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-4">
            <MaintenanceCalculator
              selectedMarket={currentProperty.market}
              landscapeHours={landscapeHours}
              selectedBranch={currentProperty.branch}
              calculatedDriveTime={proximityData?.adjustedDriveTime || calculatedDriveTime}
              savedData={maintenanceFormData}
              onDataChange={setMaintenanceFormData}
            />
          </TabsContent>
        </Tabs>

        {/* Properties Table Dialog */}
        <Dialog open={showPropertiesTable} onOpenChange={setShowPropertiesTable}>
          <DialogContent className="!max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-3">
              <DialogTitle className="text-2xl">Saved Property Estimates</DialogTitle>
              <DialogDescription className="text-base">
                View and manage all saved property estimates
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {propertiesLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
                </div>
              ) : savedProperties.length === 0 ? (
                <div className="text-center p-12 text-gray-500 text-lg">
                  No saved properties yet
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[30%]" />
                      <col className="w-[8%]" />
                      <col className="w-[13%]" />
                      <col className="w-[8%]" />
                      <col className="w-[8%]" />
                      <col className="w-[10%]" />
                      <col className="w-[7%]" />
                      <col className="w-[6%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead className="bg-gray-100 sticky top-0 border-b border-gray-300 shadow-sm z-10">
                      <tr>
                        <th className="px-5 py-3 text-left font-semibold text-gray-900">Property</th>
                        <th className="px-5 py-3 text-left font-semibold text-gray-900">Type</th>
                        <th className="px-5 py-3 text-left font-semibold text-gray-900">Region/Branch</th>
                        <th className="px-5 py-3 text-right font-semibold text-gray-900">Weekly Hours</th>
                        <th className="px-5 py-3 text-right font-semibold text-gray-900">Drive Time</th>
                        <th className="px-5 py-3 text-right font-semibold text-gray-900">Monthly Price</th>
                        <th className="px-5 py-3 text-center font-semibold text-gray-900">Margin %</th>
                        <th className="px-5 py-3 text-center font-semibold text-gray-900">Saved</th>
                        <th className="px-5 py-3 text-center font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {savedProperties.map((property, index) => {
                        // Extract data from saved form data
                        const monthlyPrice = property.maintenanceData?.hoursInput ? 
                          (() => {
                            const market = property.market || 'PHX';
                            const hourlyRate = HOURLY_RATES[market][
                              property.maintenanceData.hoursInput.isOnsiteCrew ? 'ONSITE' : 'MOBILE'
                            ];
                            const driveTime = property.maintenanceData.hoursInput.driveTimeHours * 
                              (property.maintenanceData.hoursInput.crewSize || 1);
                            const totalHoursPerVisit = property.maintenanceData.hoursInput.weeklyHours + driveTime;
                            const totalHoursPerMonth = totalHoursPerVisit * WEEKS_PER_MONTH;
                            const costPerMonth = totalHoursPerMonth * hourlyRate;
                            const margin = property.maintenanceData.sliderMargin || 55;
                            return costPerMonth / (1 - (margin / 100));
                          })() : 
                          property.maintenanceData?.priceInput?.monthlyPrice || 0;
                        
                        const margin = property.maintenanceData?.sliderMargin || 
                                     property.maintenanceData?.priceSliderMargin || 55;
                        
                        const branchName = [...BRANCHES.PHX.branches, ...BRANCHES.LV.branches]
                          .find(b => b.id === property.branch)?.name || property.branch || '-';
                        
                        return (
                          <tr key={property.id} className={`hover:bg-gray-100 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="px-5 py-3 overflow-hidden">
                              <div className="font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis pr-2">{property.name}</div>
                              {property.address && (
                                <div className="text-xs text-gray-500 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis pr-2">
                                  {property.address}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3 text-gray-700 capitalize whitespace-nowrap">
                              {property.type || '-'}
                            </td>
                            <td className="px-5 py-3">
                              <div className="text-gray-900 font-medium">{property.market}</div>
                              <div className="text-xs text-gray-500">{branchName}</div>
                            </td>
                            <td className="px-5 py-3 text-right text-gray-900 font-medium text-sm whitespace-nowrap">
                              {property.totalLandscapeHours?.toFixed(1) || '-'}
                            </td>
                            <td className="px-5 py-3 text-right text-gray-900 text-sm whitespace-nowrap">
                              {property.calculatedDriveTime !== null && property.calculatedDriveTime !== undefined
                                ? `${property.calculatedDriveTime.toFixed(1)} hrs`
                                : '-'}
                            </td>
                            <td className="px-5 py-3 text-right font-semibold text-gray-900 text-base whitespace-nowrap">
                              ${monthlyPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                margin >= 60 ? 'bg-green-100 text-green-800' :
                                margin >= 50 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {margin}%
                              </span>
                            </td>
                            <td className="px-5 py-3 text-gray-600 text-center text-sm whitespace-nowrap">
                              {property.savedAt 
                                ? new Date(property.savedAt).toLocaleDateString()
                                : '-'}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    loadProperty(property);
                                    setShowPropertiesTable(false);
                                  }}
                                  className="px-4 py-1.5"
                                >
                                  Load
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setPropertyToDelete(property.id!);
                                    setShowDeleteDialog(true);
                                  }}
                                  className="px-3 py-1.5"
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {savedProperties.length > 0 && (
              <div className="border-t pt-3 mt-2">
                <div className="flex justify-between items-center px-5">
                  <span className="text-base font-medium text-gray-700">Total Properties: {savedProperties.length}</span>
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => {
                      // Calculate summary stats
                      const totalMonthly = savedProperties.reduce((sum, property) => {
                        const monthlyPrice = property.maintenanceData?.hoursInput ? 
                          (() => {
                            const market = property.market || 'PHX';
                            const hourlyRate = HOURLY_RATES[market][
                              property.maintenanceData.hoursInput.isOnsiteCrew ? 'ONSITE' : 'MOBILE'
                            ];
                            const driveTime = property.maintenanceData.hoursInput.driveTimeHours * 
                              (property.maintenanceData.hoursInput.crewSize || 1);
                            const totalHoursPerVisit = property.maintenanceData.hoursInput.weeklyHours + driveTime;
                            const totalHoursPerMonth = totalHoursPerVisit * WEEKS_PER_MONTH;
                            const costPerMonth = totalHoursPerMonth * hourlyRate;
                            const margin = property.maintenanceData.sliderMargin || 55;
                            return costPerMonth / (1 - (margin / 100));
                          })() : 
                          property.maintenanceData?.priceInput?.monthlyPrice || 0;
                        return sum + monthlyPrice;
                      }, 0);
                      
                      alert(`Total Monthly Revenue: ${totalMonthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}\nAnnual Revenue: ${(totalMonthly * 12).toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
                    }}
                    className="px-6"
                  >
                    View Revenue Summary
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Property</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this property? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteProperty}>
                Delete Property
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import Active Properties Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Import Active Properties</DialogTitle>
              <DialogDescription>
                Upload a CSV file with your active properties to enable route optimization.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Required CSV columns:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>name</strong> - Property name</li>
                  <li>• <strong>address</strong> - Full address</li>
                  <li>• <strong>branch</strong> - Branch ID (e.g., phx-sw)</li>
                </ul>
              </div>
              
              {totalActiveProperties > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You currently have {totalActiveProperties} active properties. 
                    Importing will replace all existing properties.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="csv-file">Select CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileImport}
                  disabled={importProgress.isImporting}
                />
              </div>
              
              {importProgress.message && (
                <Alert className={importProgress.isImporting ? '' : importProgress.message.includes('Error') ? 'border-red-200' : 'border-green-200'}>
                  {importProgress.isImporting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <AlertDescription>
                    {importProgress.message}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="text-xs text-gray-500">
                <p>Example CSV format:</p>
                <pre className="bg-gray-100 p-2 rounded mt-1">
name,address,branch
Desert Ridge HOA,1234 E Desert Ridge Dr Phoenix AZ,phx-n
Camelback Office,567 W Camelback Rd Phoenix AZ,phx-sw
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PropertyCalculator;
export type { Property };