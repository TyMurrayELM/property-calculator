// app/api/active-properties/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Check if Google Maps API key is configured
if (!GOOGLE_MAPS_API_KEY) {
  console.warn('GOOGLE_MAPS_API_KEY environment variable is not set. Geocoding will fail.');
}

// Geocode an address
async function geocodeAddress(address: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status === 'OK' && data.results.length > 0) {
    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address
    };
  }
  
  return null;
}

// Batch geocode with rate limiting
async function batchGeocode(addresses: string[], delay = 100) {
  const results = [];
  
  console.log(`Starting geocoding for ${addresses.length} addresses...`);
  
  for (let i = 0; i < addresses.length; i++) {
    if (i > 0 && i % 10 === 0) {
      // Add extra delay every 10 requests to avoid rate limits
      console.log(`Geocoded ${i}/${addresses.length} addresses...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    try {
      const geocoded = await geocodeAddress(addresses[i]);
      results.push(geocoded);
    } catch (error) {
      console.error(`Failed to geocode address ${i}: ${addresses[i]}`, error);
      results.push(null);
    }
    
    // Small delay between each request
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  console.log(`Geocoding complete. Successfully geocoded ${results.filter(r => r !== null).length}/${addresses.length} addresses.`);
  return results;
}

export async function GET(request: NextRequest) {
  try {
    // Test endpoint to verify setup
    const { searchParams } = new URL(request.url);
    if (searchParams.get('test') === 'true') {
      console.log('Running system test...');
      
      // Test 1: Database connection
      const { count, error: dbError } = await supabase
        .from('active_properties')
        .select('*', { count: 'exact', head: true });
      
      // Test 2: Google Maps API
      const hasGoogleMapsKey = !!GOOGLE_MAPS_API_KEY;
      let geocodeTest = false;
      
      if (hasGoogleMapsKey) {
        try {
          const testAddress = '1234 Main St, Phoenix, AZ';
          const result = await geocodeAddress(testAddress);
          geocodeTest = !!result;
        } catch (error) {
          console.error('Geocode test failed:', error);
        }
      }
      
      return NextResponse.json({
        database: {
          connected: !dbError,
          error: dbError?.message,
          existingRecords: count || 0
        },
        googleMaps: {
          apiKeyConfigured: hasGoogleMapsKey,
          geocodeWorking: geocodeTest
        },
        status: !dbError && hasGoogleMapsKey ? 'ready' : 'not ready'
      });
    }
    
    // Fetch all active properties
    const { data: properties, error } = await supabase
      .from('active_properties')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      console.error('Error fetching active properties:', error);
      return NextResponse.json({ error: 'Failed to fetch active properties' }, { status: 500 });
    }
    
    return NextResponse.json({ properties });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // First, test the connection to the active_properties table
    console.log('Testing connection to active_properties table...');
    const { count, error: testError } = await supabase
      .from('active_properties')
      .select('*', { count: 'exact', head: true });
    
    if (testError) {
      console.error('Cannot access active_properties table:', testError);
      if (testError.code === '42P01') {
        return NextResponse.json({ 
          error: 'Table "active_properties" does not exist in your Supabase database.',
          details: 'Please run the SQL script to create the table first.',
          solution: 'Go to Supabase SQL Editor and run the CREATE TABLE script.'
        }, { status: 500 });
      }
      return NextResponse.json({ 
        error: 'Cannot access active_properties table',
        details: testError.message 
      }, { status: 500 });
    }
    console.log(`Table exists with ${count || 0} existing records.`);
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Read file content
    const text = await file.text();
    
    // Parse CSV
    const parseResult = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_')
    });
    
    if (parseResult.errors.length > 0) {
      console.error('CSV parsing errors:', parseResult.errors);
      return NextResponse.json({ 
        error: 'Failed to parse CSV', 
        details: parseResult.errors 
      }, { status: 400 });
    }
    
    const rows = parseResult.data as any[];
    
    // Simple mapping for the exact branch names you use
    const branchMap: { [key: string]: string } = {
      'phx - southeast': 'phx-se',
      'phx - southwest': 'phx-sw',
      'phx - north': 'phx-n',
      'las vegas': 'lv-main',
      'lv': 'lv-main',
      // Also include the internal IDs in case they're already normalized
      'phx-se': 'phx-se',
      'phx-sw': 'phx-sw',
      'phx-n': 'phx-n',
      'lv-main': 'lv-main'
    };
    
    // Valid internal branch IDs
    const validBranches = ['phx-sw', 'phx-se', 'phx-n', 'lv-main'];
    
    // Validate required columns
    const headers = Object.keys(rows[0] || {});
    
    // Check if we have the required data (with flexible column names)
    const hasName = headers.includes('name') || headers.includes('job_name') || headers.includes('property_name');
    const hasAddress = headers.includes('address') || headers.includes('property_address');
    const hasBranch = headers.includes('branch') || headers.includes('service_branch');
    
    if (!hasName || !hasAddress || !hasBranch) {
      const missing = [];
      if (!hasName) missing.push('name (or job_name)');
      if (!hasAddress) missing.push('address');
      if (!hasBranch) missing.push('branch');
      
      return NextResponse.json({ 
        error: `Missing required columns: ${missing.join(', ')}` 
      }, { status: 400 });
    }

    // Simple normalization function
    const normalizeBranch = (branch: string): string => {
      if (!branch) return '';
      const normalized = branch.toLowerCase().trim();
      return branchMap[normalized] || '';
    };

    // Filter out rows with empty addresses or invalid branch IDs
    const validRows = rows.filter(row => {
      const address = row.address || row.property_address || '';
      const branchRaw = row.branch || row.service_branch || '';
      const normalizedBranch = normalizeBranch(branchRaw);
      return address.trim().length > 0 && validBranches.includes(normalizedBranch);
    });
    
    const invalidRows = rows.filter(row => {
      const address = row.address || row.property_address || '';
      const branchRaw = row.branch || row.service_branch || '';
      const normalizedBranch = normalizeBranch(branchRaw);
      return address.trim().length === 0 || !validBranches.includes(normalizedBranch);
    });
    
    if (invalidRows.length > 0) {
      console.log(`Found ${invalidRows.length} invalid rows. Examples:`, 
        invalidRows.slice(0, 5).map(row => ({
          name: row.name || row.job_name || 'UNNAMED',
          address: row.address || 'MISSING',
          branch: row.branch || 'MISSING',
          normalized: normalizeBranch(row.branch || ''),
          issue: !(row.address || '').trim() ? 'Missing address' : 
                 `Invalid branch: "${row.branch || 'MISSING'}"`
        }))
      );
    }
    
    console.log(`Processing ${validRows.length} valid properties for geocoding...`);
    
    if (validRows.length === 0) {
      const sampleInvalid = invalidRows.slice(0, 5).map(row => ({
        name: row.name || row.job_name || 'UNNAMED',
        branch: row.branch || 'MISSING',
        issue: !row.address ? 'Missing address' : `Branch "${row.branch}" not recognized`
      }));
      
      return NextResponse.json({ 
        error: `No valid properties found. All ${rows.length} rows have issues.`,
        details: `Expected branch names: "Phx - SouthEast", "Phx - SouthWest", "Phx - North", "Las Vegas"`,
        samples: sampleInvalid
      }, { status: 400 });
    }
    
    // Always clear existing properties before importing new ones
    console.log('Clearing existing properties...');
    const { error: deleteError } = await supabase
      .from('active_properties')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteError) {
      console.error('Error clearing existing properties:', deleteError);
      if (deleteError.code === '42P01') {
        return NextResponse.json({ 
          error: 'Table "active_properties" does not exist. Please create it in Supabase first.',
          details: 'Run the SQL script provided in the documentation to create the table.'
        }, { status: 500 });
      }
      return NextResponse.json({ 
        error: 'Failed to clear existing properties',
        details: deleteError.message 
      }, { status: 500 });
    }
    console.log('Existing properties cleared.');
    
    // Process properties
    const processedProperties = [];
    const failedProperties = [];
    
    console.log('Starting to process properties...');
    
    // Check if we have Google Maps API key
    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json({ 
        error: 'Google Maps API key is not configured',
        details: 'Set GOOGLE_MAPS_API_KEY environment variable in your .env file',
        solution: 'Add GOOGLE_MAPS_API_KEY=your_api_key to your .env.local file'
      }, { status: 500 });
    }
    
    // Batch geocode all addresses
    const addresses = validRows.map(row => row.address || row.property_address);
    const geocodeResults = await batchGeocode(addresses);
    
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const geocoded = geocodeResults[i];
      
      const propertyName = row.name || row.property_name || row.job_name || 'Unnamed Property';
      const propertyAddress = row.address || row.property_address || '';
      
      if (!geocoded) {
        failedProperties.push({
          name: propertyName,
          address: propertyAddress,
          reason: 'Failed to geocode address'
        });
        continue;
      }
      
      // Add successfully geocoded property
      const branchRaw = row.branch || row.service_branch || '';
      const normalizedBranch = normalizeBranch(branchRaw);
      
      processedProperties.push({
        name: propertyName,
        address: propertyAddress,
        lat: geocoded.lat,
        lng: geocoded.lng,
        branch: normalizedBranch,
        is_active: true,
        uploaded_at: new Date().toISOString()
      });
    }
    
    // Insert processed properties in batches
    if (processedProperties.length > 0) {
      console.log(`Inserting ${processedProperties.length} properties into database...`);
      
      // Insert in batches of 100 to avoid potential issues
      const batchSize = 100;
      let insertedCount = 0;
      
      for (let i = 0; i < processedProperties.length; i += batchSize) {
        const batch = processedProperties.slice(i, i + batchSize);
        const { data, error: insertError } = await supabase
          .from('active_properties')
          .insert(batch)
          .select();
        
        if (insertError) {
          console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
          console.error('Failed batch sample:', batch.slice(0, 3));
          
          if (insertError.code === '23502') {
            return NextResponse.json({ 
              error: 'Some properties have invalid data. Please ensure all properties have addresses and valid branch IDs.',
              details: `Failed at batch ${i / batchSize + 1} of ${Math.ceil(processedProperties.length / batchSize)}`
            }, { status: 500 });
          }
          
          return NextResponse.json({ 
            error: `Failed to save properties: ${insertError.message}`,
            details: `Failed at batch ${i / batchSize + 1} of ${Math.ceil(processedProperties.length / batchSize)}`
          }, { status: 500 });
        }
        
        insertedCount += batch.length;
        console.log(`Inserted batch ${i / batchSize + 1}: ${insertedCount}/${processedProperties.length} properties`);
      }
    }
    
    // Collect unique invalid branches for reporting
    const invalidBranches = new Set();
    invalidRows.forEach(row => {
      const branchRaw = row.branch || row.service_branch || '';
      const normalizedBranch = normalizeBranch(branchRaw);
      if (branchRaw && !validBranches.includes(normalizedBranch)) {
        invalidBranches.add(row.branch || row.service_branch || 'EMPTY');
      }
    });
    
    let detailMessage = '';
    if (invalidRows.length > 0) {
      const reasons = [];
      const missingAddresses = invalidRows.filter(row => !(row.address || row.property_address || '').trim()).length;
      if (missingAddresses > 0) {
        reasons.push(`${missingAddresses} missing addresses`);
      }
      if (invalidBranches.size > 0) {
        reasons.push(`unrecognized branches: ${Array.from(invalidBranches).slice(0, 5).join(', ')}`);
      }
      detailMessage = ` (${reasons.join(', ')})`;
    }
    
    console.log(`Import complete: ${processedProperties.length} successful, ${failedProperties.length} failed geocoding, ${invalidRows.length} invalid rows`);
    
    return NextResponse.json({
      success: true,
      imported: processedProperties.length,
      failed: failedProperties.length,
      skipped: invalidRows.length,
      failedProperties: failedProperties,
      total: rows.length,
      message: invalidRows.length > 0 
        ? `Imported ${processedProperties.length} properties. Skipped ${invalidRows.length} rows${detailMessage}.`
        : `Successfully imported ${processedProperties.length} properties`
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get nearby properties for proximity calculation - UPDATED VERSION
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lng, branch, radiusMiles = 1 } = body;
    
    // Validate all required parameters
    if (!lat || !lng || !branch) {
      console.error('Missing parameters:', { lat, lng, branch });
      return NextResponse.json({ 
        error: 'Missing required parameters: lat, lng, and branch are all required' 
      }, { status: 400 });
    }
    
    // Ensure branch is a string
    const branchStr = String(branch).toLowerCase();
    
    console.log('Proximity calculation request:', { lat, lng, branch: branchStr, radiusMiles });
    
    // Fetch all active properties for the same branch
    const { data: properties, error } = await supabase
      .from('active_properties')
      .select('*')
      .eq('is_active', true)
      .eq('branch', branchStr);
    
    if (error) {
      console.error('Error fetching properties:', error);
      return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
    }
    
    console.log(`Found ${properties?.length || 0} properties for branch ${branchStr}`);
    
    // Calculate distances and filter by radius
    const nearbyProperties = properties?.map(property => {
      // Haversine formula for distance calculation
      const R = 3959; // Earth's radius in miles
      const dLat = (property.lat - lat) * Math.PI / 180;
      const dLon = (property.lng - lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat * Math.PI / 180) * Math.cos(property.lat * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      return {
        ...property,
        distance: Math.round(distance * 100) / 100
      };
    }).filter(p => p.distance <= radiusMiles)
      .sort((a, b) => a.distance - b.distance) || [];
    
    // Calculate proximity factor
    const count = nearbyProperties.length;
    let proximityFactor = 1.0; // Default: no reduction
    let description = 'Isolated property';
    
    if (count >= 10) {
      proximityFactor = 0.25;
      description = `Dense route - ${count} properties within ${radiusMiles} mile${radiusMiles > 1 ? 's' : ''}`;
    } else if (count >= 5) {
      proximityFactor = 0.5;
      description = `Good route density - ${count} properties within ${radiusMiles} mile${radiusMiles > 1 ? 's' : ''}`;
    } else if (count >= 3) {
      proximityFactor = 0.7;
      description = `Moderate route - ${count} properties within ${radiusMiles} mile${radiusMiles > 1 ? 's' : ''}`;
    } else if (count >= 1) {
      proximityFactor = 0.85;
      description = `Light route - ${count} propert${count === 1 ? 'y' : 'ies'} within ${radiusMiles} mile${radiusMiles > 1 ? 's' : ''}`;
    }
    
    console.log(`Proximity calculation complete: ${count} nearby properties, factor: ${proximityFactor}`);
    
    return NextResponse.json({
      nearbyProperties,
      proximityFactor,
      description,
      count
    });
  } catch (error) {
    console.error('Proximity calculation error:', error);
    return NextResponse.json({ 
      error: 'Failed to calculate proximity',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}