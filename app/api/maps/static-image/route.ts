import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Proxies a Google Static Maps image so the API key never reaches the browser.
export async function GET(request: NextRequest) {
  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const propertyLat = searchParams.get('plat');
  const propertyLng = searchParams.get('plng');
  const branchLat = searchParams.get('blat');
  const branchLng = searchParams.get('blng');
  const branchIcon = searchParams.get('bicon') || undefined;
  const zoomParam = searchParams.get('zoom');

  if (!propertyLat || !propertyLng || !branchLat || !branchLng) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
  }

  const pLat = Number(propertyLat);
  const pLng = Number(propertyLng);
  const bLat = Number(branchLat);
  const bLng = Number(branchLng);
  const zoomOverride = zoomParam ? Number(zoomParam) : undefined;

  try {
    // Fetch the actual driving route so we can draw the real polyline
    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${pLat},${pLng}&destination=${bLat},${bLng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
    const directionsResponse = await fetch(directionsUrl);
    const directionsData = await directionsResponse.json();

    let routePath = '';
    let bounds: { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } } | null = null;

    if (directionsData.status === 'OK' && directionsData.routes.length > 0) {
      const route = directionsData.routes[0];
      routePath = route.overview_polyline.points;
      bounds = route.bounds;
    }

    let centerLat = (pLat + bLat) / 2;
    let centerLng = (pLng + bLng) / 2;
    let zoom = 11;

    if (bounds) {
      centerLat = (bounds.northeast.lat + bounds.southwest.lat) / 2;
      centerLng = (bounds.northeast.lng + bounds.southwest.lng) / 2;
      const latDiff = bounds.northeast.lat - bounds.southwest.lat;
      const lngDiff = bounds.northeast.lng - bounds.southwest.lng;
      const maxDiff = Math.max(latDiff, lngDiff);
      if (maxDiff > 0.5) zoom = 9;
      else if (maxDiff > 0.2) zoom = 10;
      else if (maxDiff > 0.1) zoom = 11;
      else if (maxDiff > 0.05) zoom = 12;
      else zoom = 13;
    }

    if (zoomOverride) zoom = zoomOverride;

    const params = new URLSearchParams({
      size: '800x200',
      scale: '2', // retina — renders at 1600x400 for crisp display on modern screens
      maptype: 'roadmap',
      key: GOOGLE_MAPS_API_KEY,
    });

    params.append('markers', `color:red|label:P|size:large|${pLat},${pLng}`);

    if (branchIcon) {
      const cleanIconUrl = branchIcon.split('?')[0];
      params.append('markers', `icon:${encodeURIComponent(cleanIconUrl)}|${bLat},${bLng}`);
    } else {
      params.append('markers', `color:blue|label:B|size:large|${bLat},${bLng}`);
    }

    if (routePath) {
      params.append('path', `color:0x0000ff|weight:5|enc:${routePath}`);
    } else {
      params.append('path', `color:0x0000ff|weight:5|${pLat},${pLng}|${bLat},${bLng}`);
      params.append('center', `${centerLat},${centerLng}`);
      params.append('zoom', String(zoom));
    }

    const googleUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
    const imageResponse = await fetch(googleUrl);

    if (!imageResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch map image' }, { status: 502 });
    }

    const buffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'X-Map-Zoom': String(zoom),
      },
    });
  } catch (error) {
    console.error('Error proxying static map:', error);
    return NextResponse.json({ error: 'Failed to generate map' }, { status: 500 });
  }
}
