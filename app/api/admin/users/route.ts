import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';
import { authOptions, getSupabaseAdmin } from '@/lib/auth';
import { parseJson } from '@/lib/validate';

const AddUserBody = z.object({
  email: z.string().email().transform(s => s.trim().toLowerCase()),
  name: z.string().trim().optional(),
  role: z.enum(['admin', 'user']).optional(),
});

const UpdateUserBody = z
  .object({
    id: z.string().uuid(),
    is_active: z.boolean().optional(),
    role: z.enum(['admin', 'user']).optional(),
  })
  .refine(b => b.is_active !== undefined || b.role !== undefined, {
    message: 'At least one of is_active or role must be provided',
  });

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

  const parsed = await parseJson(request, AddUserBody);
  if (!parsed.ok) return parsed.error;
  const { email } = parsed.data;
  const name = parsed.data.name || email.split('@')[0];
  const role = parsed.data.role ?? 'user';

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

  const parsed = await parseJson(request, UpdateUserBody);
  if (!parsed.ok) return parsed.error;
  const { id, is_active, role } = parsed.data;

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
  if (is_active !== undefined) update.is_active = is_active;
  if (role !== undefined) update.role = role;

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
  const idParam = searchParams.get('id');
  const parsedId = z.string().uuid().safeParse(idParam);
  if (!parsedId.success) {
    return NextResponse.json({ error: 'A valid user id is required' }, { status: 400 });
  }
  const id = parsedId.data;

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
