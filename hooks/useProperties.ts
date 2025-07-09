// hooks/useProperties.ts
import { useState, useEffect } from 'react';
import { Property } from '@/components/PropertyCalculator';

export const useProperties = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch properties on mount
  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/properties');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch properties');
      }
      
      // Transform database properties to match Property interface
      const transformedProperties = data.properties.map((p: any) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        type: p.type,
        market: p.market,
        branch: p.branch,
        landscapeData: p.landscape_data,
        maintenanceData: p.maintenance_data,
        totalLandscapeHours: p.total_landscape_hours,
        calculatedDriveTime: p.calculated_drive_time,
        bidDueDate: p.bid_due_date,
        status: p.status,
        notes: p.notes,
        savedAt: new Date(p.updated_at)
      }));
      
      setProperties(transformedProperties);
    } catch (err) {
      console.error('Error fetching properties:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch properties');
    } finally {
      setLoading(false);
    }
  };

  const saveProperty = async (property: Property) => {
    try {
      const method = property.id ? 'PUT' : 'POST';
      const response = await fetch('/api/properties', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(property)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save property');
      }
      
      // Transform the returned property
      const transformedProperty = {
        id: data.property.id,
        name: data.property.name,
        address: data.property.address,
        type: data.property.type,
        market: data.property.market,
        branch: data.property.branch,
        landscapeData: data.property.landscape_data,
        maintenanceData: data.property.maintenance_data,
        totalLandscapeHours: data.property.total_landscape_hours,
        calculatedDriveTime: data.property.calculated_drive_time,
        bidDueDate: data.property.bid_due_date,
        status: data.property.status,
        notes: data.property.notes,
        savedAt: new Date(data.property.updated_at)
      };
      
      // Update local state
      if (property.id) {
        setProperties(prev => prev.map(p => p.id === property.id ? transformedProperty : p));
      } else {
        setProperties(prev => [...prev, transformedProperty]);
      }
      
      return transformedProperty;
    } catch (err) {
      console.error('Error saving property:', err);
      throw err;
    }
  };

  const deleteProperty = async (id: string) => {
    try {
      const response = await fetch(`/api/properties?id=${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete property');
      }
      
      // Update local state
      setProperties(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error deleting property:', err);
      throw err;
    }
  };

  return {
    properties,
    loading,
    error,
    saveProperty,
    deleteProperty,
    refreshProperties: fetchProperties
  };
};