// app/api/properties/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabasePublic as supabase } from '@/lib/auth';
import { parseJson } from '@/lib/validate';

const PropertyBody = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  address: z.string().max(500).nullable().optional(),
  type: z.string().max(50).optional().default(''),
  market: z.enum(['PHX', 'LV']),
  branch: z.string().max(50).nullable().optional(),
  landscapeData: z.unknown().nullable().optional(),
  maintenanceData: z.unknown().nullable().optional(),
  totalLandscapeHours: z.number().nullable().optional(),
  calculatedDriveTime: z.number().nullable().optional(),
  bidDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.string().max(50).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const UpdatePropertyBody = PropertyBody.extend({
  id: z.string().uuid(),
});

// GET - Fetch all properties (paginated to bypass Supabase's 1000-row default cap)
export async function GET() {
  try {
    const PAGE_SIZE = 1000;
    const all: any[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('updated_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('Error fetching properties:', error);
        return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
      }

      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return NextResponse.json({ properties: all });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST - Create new property
export async function POST(request: NextRequest) {
  const parsed = await parseJson(request, PropertyBody);
  if (!parsed.ok) return parsed.error;
  const property = parsed.data;

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
      notes: property.notes,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating property:', error);
    return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
  }

  return NextResponse.json({ property: data });
}

// PUT - Update existing property
export async function PUT(request: NextRequest) {
  const parsed = await parseJson(request, UpdatePropertyBody);
  if (!parsed.ok) return parsed.error;
  const property = parsed.data;

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
      updated_at: new Date().toISOString(),
    })
    .eq('id', property.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating property:', error);
    return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
  }

  return NextResponse.json({ property: data });
}

// DELETE - Delete property
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsedId = z.string().uuid().safeParse(searchParams.get('id'));
  if (!parsedId.success) {
    return NextResponse.json({ error: 'A valid property id is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('properties')
    .delete()
    .eq('id', parsedId.data);

  if (error) {
    console.error('Error deleting property:', error);
    return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}