'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Loader2, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react';

interface RouteMapProps {
  propertyAddress: string;
  branch: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    icon?: string;
  };
  calculatedDriveTime: number | null;
}

const RouteMap: React.FC<RouteMapProps> = ({ propertyAddress, branch, calculatedDriveTime }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [mapUrl, setMapUrl] = useState('');
  const [zoomLevel, setZoomLevel] = useState<number | null>(null);
  const [propertyCoords, setPropertyCoords] = useState<{ lat: number; lng: number } | null>(null);

  const generateMapUrl = async (customZoom?: number) => {
    setIsLoading(true);
    
    try {
      // First geocode the property address if we haven't already
      if (!propertyCoords) {
        const response = await fetch('/api/maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'geocode',
            data: { address: propertyAddress }
          })
        });
        
        const geocodeResult = await response.json();
        
        if (!geocodeResult.success) return;
        
        setPropertyCoords(geocodeResult.location);
        
        // Get map with auto-calculated zoom
        const mapResponse = await fetch('/api/maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'staticmap',
            data: {
              propertyLat: geocodeResult.location.lat,
              propertyLng: geocodeResult.location.lng,
              branchLat: branch.lat,
              branchLng: branch.lng,
              branchIcon: branch.icon,
              zoom: customZoom
            }
          })
        });
        
        const mapResult = await mapResponse.json();
        if (mapResult.success) {
          setMapUrl(mapResult.mapUrl);
          if (!zoomLevel && mapResult.zoom) {
            setZoomLevel(mapResult.zoom);
          }
        }
      } else {
        // We already have coordinates, just update zoom
        const mapResponse = await fetch('/api/maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'staticmap',
            data: {
              propertyLat: propertyCoords.lat,
              propertyLng: propertyCoords.lng,
              branchLat: branch.lat,
              branchLng: branch.lng,
              branchIcon: branch.icon,
              zoom: customZoom || zoomLevel
            }
          })
        });
        
        const mapResult = await mapResponse.json();
        if (mapResult.success) {
          setMapUrl(mapResult.mapUrl);
        }
      }
    } catch (error) {
      console.error('Error generating map:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!propertyAddress || !branch) return;
    generateMapUrl();
  }, [propertyAddress, branch]);

  const handleZoom = (direction: 'in' | 'out') => {
    if (!zoomLevel) return;
    
    const newZoom = direction === 'in' 
      ? Math.min(zoomLevel + 1, 18) 
      : Math.max(zoomLevel - 1, 8);
    
    setZoomLevel(newZoom);
    generateMapUrl(newZoom);
  };

  const openInGoogleMaps = () => {
    if (!propertyCoords) return;
    
    const url = `https://www.google.com/maps/dir/${propertyCoords.lat},${propertyCoords.lng}/${branch.lat},${branch.lng}`;
    window.open(url, '_blank');
  };

  if (!propertyAddress || !branch) return null;

  return (
    <Card className="overflow-hidden">
      <div className="bg-blue-900 text-white p-3 flex justify-between items-center">
        <h3 className="text-sm font-medium">Route Visualization</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-blue-800 rounded">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-white hover:bg-blue-700"
              onClick={() => handleZoom('out')}
              disabled={!zoomLevel || zoomLevel <= 8}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs px-2">{zoomLevel || '-'}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-white hover:bg-blue-700"
              onClick={() => handleZoom('in')}
              disabled={!zoomLevel || zoomLevel >= 18}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-white hover:bg-blue-700"
            onClick={openInGoogleMaps}
            disabled={!propertyCoords}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            <span className="text-xs">Open in Maps</span>
          </Button>
        </div>
      </div>
      <CardContent className="p-0">
        <div className="relative w-full" style={{ paddingBottom: '25%' }}>
          <div className="absolute inset-0 bg-gray-100">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : mapUrl ? (
              <>
                <img 
                  src={mapUrl} 
                  alt="Route map" 
                  className="w-full h-full object-contain bg-gray-50"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-3">
                  <div className="text-white text-xs space-y-1">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">Property:</span>
                        <span className="ml-1 opacity-90">{propertyAddress}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Navigation className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">Branch:</span>
                        <span className="ml-1 opacity-90">{branch.name}</span>
                      </div>
                    </div>
                    {calculatedDriveTime && (
                      <div className="text-green-400 font-medium">
                        {calculatedDriveTime} hrs (per crew member)
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                Unable to load map
              </div>
            )}
          </div>
        </div>
        <div className="p-3 bg-gray-50 text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span className="flex items-center">
              <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2"></span>
              Property Location
            </span>
            <span className="text-gray-400">|</span>
            <span className="flex items-center">
              <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
              Service Branch
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RouteMap;