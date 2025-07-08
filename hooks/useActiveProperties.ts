// hooks/useActiveProperties.ts
import { useState, useEffect } from 'react';

interface ActiveProperty {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  branch: string;
  is_active: boolean;
  uploaded_at: string;
  distance?: number;
}

interface ProximityResult {
  nearbyProperties: ActiveProperty[];
  proximityFactor: number;
  description: string;
  count: number;
}

export function useActiveProperties() {
  const [activeProperties, setActiveProperties] = useState<ActiveProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    isImporting: boolean;
    message: string;
  }>({ isImporting: false, message: '' });

  // Fetch all active properties
  const fetchActiveProperties = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/active-properties');
      const data = await response.json();
      
      if (response.ok) {
        setActiveProperties(data.properties || []);
      }
    } catch (error) {
      console.error('Error fetching active properties:', error);
    } finally {
      setLoading(false);
    }
  };

  // Import properties from CSV
  const importProperties = async (file: File, clearExisting: boolean = true) => {
    setImportProgress({ isImporting: true, message: 'Processing file...' });
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clearExisting', clearExisting.toString());
      
      setImportProgress({ isImporting: true, message: 'Geocoding addresses...' });
      
      const response = await fetch('/api/active-properties', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setImportProgress({ 
          isImporting: false, 
          message: `Successfully imported ${result.imported} properties` 
        });
        
        // Refresh the list
        await fetchActiveProperties();
        
        return { success: true, ...result };
      } else {
        setImportProgress({ 
          isImporting: false, 
          message: `Error: ${result.error}` 
        });
        return { success: false, error: result.error };
      }
    } catch (error) {
      setImportProgress({ 
        isImporting: false, 
        message: 'Import failed' 
      });
      return { success: false, error: 'Import failed' };
    }
  };

  // Calculate proximity for a given location - UPDATED VERSION
  const calculateProximity = async (
    lat: number, 
    lng: number, 
    branch: string,
    radiusMiles: number = 1
  ): Promise<ProximityResult | null> => {
    try {
      // Validate inputs before sending
      if (!lat || !lng || !branch) {
        console.error('Missing required parameters for proximity calculation:', { lat, lng, branch });
        return null;
      }

      const response = await fetch('/api/active-properties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, branch, radiusMiles })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Proximity calculation failed:', response.status, errorText);
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error calculating proximity:', error);
      return null;
    }
  };

  // Load active properties on mount
  useEffect(() => {
    fetchActiveProperties();
  }, []);

  return {
    activeProperties,
    loading,
    importProgress,
    importProperties,
    calculateProximity,
    refreshProperties: fetchActiveProperties,
    totalCount: activeProperties.length
  };
}