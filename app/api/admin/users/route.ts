import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions, getSupabaseAdmin } from '@/lib/auth';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (session.user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { error: NextResponse.json({ error: 'Supabase not configured' }, { status: 500 }) };
  }
  return { session, supabase };
}

export async function GET() {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;

  const { data, error } = await guard.supabase
    .from('allowed_users')
    .select('*')
    .order('last_login', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
  return NextResponse.json({ users: data || [] });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;

  const body = await request.json();
  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim() || email.split('@')[0];
  const role = body.role === 'admin' ? 'admin' : 'user';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }

  const { data, error } = await guard.supabase
    .from('allowed_users')
    .insert({
      email,
      name,
      role,
      added_by: guard.session.user.email,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This email is already in the allowlist' }, { status: 409 });
    }
    console.error('Error adding user:', error);
    return NextResponse.json({ error: 'Failed to add user' }, { status: 500 });
  }
  return NextResponse.json({ user: data });
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;

  const body = await request.json();
  const { id, is_active, role } = body;

  if (!id) {
    return NextResponse.json({ error: 'User id required' }, { status: 400 });
  }

  // Fetch the target so we can prevent self-demotion / self-deactivation
  const { data: target, error: fetchError } = await guard.supabase
    .from('allowed_users')
    .select('email')
    .eq('id', id)
    .single();

  if (fetchError || !target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (target.email === guard.session.user.email && (is_active === false || role === 'user')) {
    return NextResponse.json({ error: "You can't disable or demote yourself" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof is_active === 'boolean') update.is_active = is_active;
  if (role === 'admin' || role === 'user') update.role = role;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await guard.supabase
    .from('allowed_users')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
  return NextResponse.json({ user: data });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'User id required' }, { status: 400 });
  }

  // Prevent self-delete
  const { data: target } = await guard.supabase
    .from('allowed_users')
    .select('email')
    .eq('id', id)
    .single();

  if (target?.email === guard.session.user.email) {
    return NextResponse.json({ error: "You can't delete yourself" }, { status: 400 });
  }

  const { error } = await guard.supabase.from('allowed_users').delete().eq('id', id);
  if (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
