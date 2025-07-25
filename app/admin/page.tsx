'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, UserPlus, Shield, Loader2, AlertCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AllowedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  added_by: string;
  added_at: string;
  is_active: boolean;
  notes?: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'user' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check if user is admin
  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) {
      fetchUsers();
    }
  }, [status, isAdmin]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('allowed_users')
        .select('*')
        .order('email');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const addUser = async () => {
    setError('');
    setSuccess('');
    
    if (!newUser.email) {
      setError('Email is required');
      return;
    }

    try {
      const { error } = await supabase
        .from('allowed_users')
        .insert({
          email: newUser.email.toLowerCase(),
          name: newUser.name || newUser.email.split('@')[0],
          role: newUser.role,
          added_by: session?.user?.email
        });
      
      if (error) throw error;
      
      setSuccess(`Added ${newUser.email} to allowlist`);
      setNewUser({ email: '', name: '', role: 'user' });
      fetchUsers();
    } catch (error: any) {
      if (error.code === '23505') {
        setError('This email is already in the allowlist');
      } else {
        setError('Failed to add user');
      }
    }
  };

  const toggleUserStatus = async (user: AllowedUser) => {
    try {
      const { error } = await supabase
        .from('allowed_users')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);
      
      if (error) throw error;
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      setError('Failed to update user status');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user from the allowlist?')) return;
    
    try {
      const { error } = await supabase
        .from('allowed_users')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Failed to delete user');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You must be an administrator to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">User Allowlist Management</h1>
          <p className="text-gray-600 mt-2">Control who can access the Property Calculator</p>
        </div>

        {/* Add User Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add User to Allowlist
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="mb-4 border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="user@encorelm.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Full Name</Label>
                <Input
                  placeholder="John Doe"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Role</Label>
                <select
                  className="w-full h-10 px-3 border rounded-md"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={addUser} className="w-full">
                  Add User
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>Allowed Users ({users.length})</CardTitle>
            <CardDescription>
              Users who can access the Property Calculator
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Role</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Added By</th>
                      <th className="text-left p-2">Added On</th>
                      <th className="text-center p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{user.email}</td>
                        <td className="p-2">{user.name}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === 'admin' 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="p-2">
                          <button
                            onClick={() => toggleUserStatus(user)}
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              user.is_active 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="p-2 text-sm text-gray-600">{user.added_by}</td>
                        <td className="p-2 text-sm text-gray-600">
                          {new Date(user.added_at).toLocaleDateString()}
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteUser(user.id)}
                            disabled={user.email === session?.user?.email}
                            title={user.email === session?.user?.email ? "Can't delete yourself" : 'Delete user'}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}