import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json();

    switch (action) {
      case 'geocode':
        return await geocodeAddress(data.address);
      
      case 'distance':
        return await calculateDistance(data.origin, data.destination);
      
      case 'findClosest':
        return await findClosestBranch(data.address, data.branches);
      
      case 'staticmap':
        return getProxiedMapUrl(data);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Maps API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function geocodeAddress(address: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status === 'OK' && data.results.length > 0) {
    const result = data.results[0];
    return NextResponse.json({
      success: true,
      location: result.geometry.location,
      formatted_address: result.formatted_address
    });
  }
  
  return NextResponse.json({
    success: false,
    error: 'Address not found'
  });
}

async function calculateDistance(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) {
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&units=imperial&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
    const element = data.rows[0].elements[0];
    return NextResponse.json({
      success: true,
      distance: element.distance,
      duration: element.duration,
      // Convert duration to hours for the calculator
      durationHours: element.duration.value / 3600
    });
  }
  
  return NextResponse.json({
    success: false,
    error: 'Could not calculate distance'
  });
}

async function findClosestBranch(address: string, branches: any[]) {
  // First geocode the address
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
  const geocodeResponse = await fetch(geocodeUrl);
  const geocodeData = await geocodeResponse.json();
  
  if (geocodeData.status !== 'OK' || geocodeData.results.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'Address not found'
    });
  }
  
  const propertyLocation = geocodeData.results[0].geometry.location;
  
  // Calculate distances to all branches
  const origins = `${propertyLocation.lat},${propertyLocation.lng}`;
  const destinations = branches.map(b => `${b.lat},${b.lng}`).join('|');
  
  const distanceUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&units=imperial&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
  
  const distanceResponse = await fetch(distanceUrl);
  const distanceData = await distanceResponse.json();
  
  if (distanceData.status !== 'OK') {
    return NextResponse.json({
      success: false,
      error: 'Could not calculate distances'
    });
  }
  
  // Find the closest branch
  type Duration = { value: number; text: string };
  let closestBranch: unknown = null;
  let shortestDistance = Infinity;
  let closestDuration: Duration | null = null;

  distanceData.rows[0].elements.forEach((element: any, index: number) => {
    if (element.status === 'OK' && element.distance.value < shortestDistance) {
      shortestDistance = element.distance.value;
      closestBranch = branches[index];
      closestDuration = element.duration;
    }
  });

  if (!closestBranch || !closestDuration) {
    return NextResponse.json({
      success: false,
      error: 'Could not determine closest branch'
    });
  }

  return NextResponse.json({
    success: true,
    closestBranch,
    duration: closestDuration,
    durationHours: (closestDuration as Duration).value / 3600,
    propertyLocation,
    formatted_address: geocodeData.results[0].formatted_address
  });
}

// Returns a URL pointing to our own /api/maps/static-image proxy, so the
// Google API key is never exposed to the browser.
function getProxiedMapUrl(data: {
  propertyLat: number;
  propertyLng: number;
  branchLat: number;
  branchLng: number;
  branchIcon?: string;
  zoom?: number;
}) {
  const params = new URLSearchParams({
    plat: String(data.propertyLat),
    plng: String(data.propertyLng),
    blat: String(data.branchLat),
    blng: String(data.branchLng),
  });
  if (data.branchIcon) params.set('bicon', data.branchIcon);
  if (data.zoom) params.set('zoom', String(data.zoom));

  return NextResponse.json({
    success: true,
    mapUrl: `/api/maps/static-image?${params.toString()}`,
  });
}