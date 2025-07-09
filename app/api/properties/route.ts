// app/api/properties/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Fetch all properties
export async function GET() {
  try {
    const { data: properties, error } = await supabase
      .from('properties')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching properties:', error);
      return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
    }

    return NextResponse.json({ properties: properties || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST - Create new property
export async function POST(request: NextRequest) {
  try {
    const property = await request.json();
    
    const { data, error } = await supabase
      .from('properties')
      .insert({
        name: property.name,
        address: property.address,
        type: property.type,
        market: property.market,
        branch: property.branch,
        landscape_data: property.landscapeData,
        maintenance_data: property.maintenanceData,
        total_landscape_hours: property.totalLandscapeHours,
        calculated_drive_time: property.calculatedDriveTime,
        bid_due_date: property.bidDueDate,
        status: property.status,
        notes: property.notes
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating property:', error);
      return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
    }

    return NextResponse.json({ property: data });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT - Update existing property
export async function PUT(request: NextRequest) {
  try {
    const property = await request.json();
    
    if (!property.id) {
      return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('properties')
      .update({
        name: property.name,
        address: property.address,
        type: property.type,
        market: property.market,
        branch: property.branch,
        landscape_data: property.landscapeData,
        maintenance_data: property.maintenanceData,
        total_landscape_hours: property.totalLandscapeHours,
        calculated_drive_time: property.calculatedDriveTime,
        bid_due_date: property.bidDueDate,
        status: property.status,
        notes: property.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', property.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating property:', error);
      return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
    }

    return NextResponse.json({ property: data });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE - Delete property
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
    }

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
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}