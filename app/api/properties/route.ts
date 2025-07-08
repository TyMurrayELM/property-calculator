// app/api/properties/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Fetch all properties (no auth check)
    const { data: properties, error } = await supabase
      .from('properties')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching properties:', error);
      return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
    }
    
    return NextResponse.json({ properties });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Insert new property (no user_id needed)
    const { data, error } = await supabase
      .from('properties')
      .insert({
        name: body.name,
        address: body.address,
        type: body.type,
        market: body.market,
        branch: body.branch,
        landscape_data: body.landscapeData,
        maintenance_data: body.maintenanceData,
        total_landscape_hours: body.totalLandscapeHours,
        calculated_drive_time: body.calculatedDriveTime
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating property:', error);
      return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
    }
    
    return NextResponse.json({ property: data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Update property
    const { data, error } = await supabase
      .from('properties')
      .update({
        name: body.name,
        address: body.address,
        type: body.type,
        market: body.market,
        branch: body.branch,
        landscape_data: body.landscapeData,
        maintenance_data: body.maintenanceData,
        total_landscape_hours: body.totalLandscapeHours,
        calculated_drive_time: body.calculatedDriveTime
      })
      .eq('id', body.id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating property:', error);
      return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
    }
    
    return NextResponse.json({ property: data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
    }
    
    // Delete property
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting property:', error);
      return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}