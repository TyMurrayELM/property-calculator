import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json();
    
    // Get the request headers to determine the host
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseIconUrl = `${protocol}://${host}`;

    switch (action) {
      case 'geocode':
        return await geocodeAddress(data.address);
      
      case 'distance':
        return await calculateDistance(data.origin, data.destination);
      
      case 'findClosest':
        return await findClosestBranch(data.address, data.branches);
      
      case 'staticmap':
        return await getStaticMapUrl({ ...data, baseIconUrl });
      
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
  let closestBranch = null;
  let shortestDistance = Infinity;
  let closestDuration = null;
  
  distanceData.rows[0].elements.forEach((element: any, index: number) => {
    if (element.status === 'OK' && element.distance.value < shortestDistance) {
      shortestDistance = element.distance.value;
      closestBranch = branches[index];
      closestDuration = element.duration;
    }
  });
  
  if (!closestBranch) {
    return NextResponse.json({
      success: false,
      error: 'Could not determine closest branch'
    });
  }
  
  return NextResponse.json({
    success: true,
    closestBranch,
    duration: closestDuration,
    durationHours: closestDuration.value / 3600,
    propertyLocation,
    formatted_address: geocodeData.results[0].formatted_address
  });
}

async function getStaticMapUrl(data: { 
  propertyLat: number; 
  propertyLng: number; 
  branchLat: number; 
  branchLng: number;
  branchIcon?: string;
  zoom?: number;
  baseIconUrl: string;
}) {
  try {
    // First, get the actual driving route using Directions API
    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${data.propertyLat},${data.propertyLng}&destination=${data.branchLat},${data.branchLng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
    
    const directionsResponse = await fetch(directionsUrl);
    const directionsData = await directionsResponse.json();
    
    let routePath = '';
    let bounds = null;
    
    if (directionsData.status === 'OK' && directionsData.routes.length > 0) {
      // Get the encoded polyline from the route
      const route = directionsData.routes[0];
      routePath = route.overview_polyline.points;
      bounds = route.bounds;
    }
    
    // Calculate center and zoom from bounds if available
    let centerLat = (data.propertyLat + data.branchLat) / 2;
    let centerLng = (data.propertyLng + data.branchLng) / 2;
    let zoom = 11; // Default zoom
    
    if (bounds) {
      centerLat = (bounds.northeast.lat + bounds.southwest.lat) / 2;
      centerLng = (bounds.northeast.lng + bounds.southwest.lng) / 2;
      
      // Calculate zoom based on bounds
      const latDiff = bounds.northeast.lat - bounds.southwest.lat;
      const lngDiff = bounds.northeast.lng - bounds.southwest.lng;
      const maxDiff = Math.max(latDiff, lngDiff);
      
      if (maxDiff > 0.5) zoom = 9;
      else if (maxDiff > 0.2) zoom = 10;
      else if (maxDiff > 0.1) zoom = 11;
      else if (maxDiff > 0.05) zoom = 12;
      else zoom = 13;
    }
    
    // Override with custom zoom if provided
    if (data.zoom) {
      zoom = data.zoom;
    }
    
    const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';
    const params = new URLSearchParams({
      size: '800x200',
      scale: '1',
      maptype: 'roadmap',
      key: GOOGLE_MAPS_API_KEY,
    });
    
    // Add markers
    params.append('markers', `color:red|label:P|size:large|${data.propertyLat},${data.propertyLng}`);
    
    // Add branch marker with custom icon if available
    if (data.branchIcon) {
      // Check if branchIcon is already a full URL (contains http)
      const iconUrl = data.branchIcon.includes('http') 
        ? data.branchIcon 
        : `${data.baseIconUrl}/icons/${data.branchIcon}`;
      
      // Try using the icon without query parameters for Google Static Maps
      const cleanIconUrl = iconUrl.split('?')[0];
      
      params.append('markers', `icon:${encodeURIComponent(cleanIconUrl)}|${data.branchLat},${data.branchLng}`);
    } else {
      // Fallback to default blue marker with B label
      params.append('markers', `color:blue|label:B|size:large|${data.branchLat},${data.branchLng}`);
    }
    
    // Add the actual route path if we got it, otherwise fall back to straight line
    if (routePath) {
      // Use the encoded polyline for the actual driving route
      params.append('path', `color:0x0000ff|weight:5|enc:${routePath}`);
    } else {
      // Fallback to straight line if directions failed
      params.append('path', `color:0x0000ff|weight:5|${data.propertyLat},${data.propertyLng}|${data.branchLat},${data.branchLng}`);
    }
    
    // Don't set center/zoom if we have a route - let Google auto-fit
    if (!routePath) {
      params.append('center', `${centerLat},${centerLng}`);
      params.append('zoom', zoom.toString());
    }
    
    return NextResponse.json({
      success: true,
      mapUrl: `${baseUrl}?${params.toString()}`,
      zoom: zoom
    });
  } catch (error) {
    console.error('Error generating static map URL:', error);
    
    // Fallback to simple straight line map if directions fail
    const centerLat = (data.propertyLat + data.branchLat) / 2;
    const centerLng = (data.propertyLng + data.branchLng) / 2;
    const zoom = data.zoom || 11;
    
    const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';
    const params = new URLSearchParams({
      size: '800x200',
      scale: '1',
      maptype: 'roadmap',
      center: `${centerLat},${centerLng}`,
      zoom: zoom.toString(),
      key: GOOGLE_MAPS_API_KEY,
      markers: `color:red|label:P|size:large|${data.propertyLat},${data.propertyLng}`,
    });
    
    params.append('markers', `color:blue|label:B|size:large|${data.branchLat},${data.branchLng}`);
    params.append('path', `color:0x0000ff|weight:5|${data.propertyLat},${data.propertyLng}|${data.branchLat},${data.branchLng}`);
    
    return NextResponse.json({
      success: true,
      mapUrl: `${baseUrl}?${params.toString()}`,
      zoom: zoom
    });
  }
}