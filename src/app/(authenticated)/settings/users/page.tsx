'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import Pagination from '@/components/Pagination';
import { UserProfile } from '@/lib/types';
import { fetchUsers, updateUserStatus, addUserProfile } from '@/lib/firestore';
import { secondaryAuth } from '@/lib/secondaryApp';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { Loader2, UserPlus, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function UsersPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    loadUsers();
  }, [profile, router]);

  async function loadUsers() {
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(uid: string, currentStatus: boolean, role: string) {
    if (role === 'admin') return; // Cannot disable admin from UI
    
    try {
      await updateUserStatus(uid, !currentStatus);
      setUsers((prev) => 
        prev.map(u => u.uid === uid ? { ...u, active: !currentStatus, updatedAt: new Date().toISOString() } : u)
      );
    } catch (err) {
      console.error('Error toggling user status:', err);
      alert('Failed to update user status.');
    }
  }

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      // Create user in Firebase Auth using secondary app to prevent signing out current admin
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await signOut(secondaryAuth); // immediately sign them out on the secondary instance
      
      const newUid = userCredential.user.uid;
      
      // Create Firestore profile
      const newProfile: UserProfile = {
        uid: newUid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: 'staff',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await addUserProfile(newProfile);
      
      setSuccess('Staff user created successfully.');
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setIsAdding(false);
      loadUsers();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error creating user:', err);
      setError(err.message || 'Failed to create user. Ensure email is unique and valid.');
    } finally {
      setSubmitting(false);
    }
  }

  if (profile?.role !== 'admin') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </AppLayout>
    );
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = users.slice(startIndex, startIndex + itemsPerPage);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
          
          <div className="flex items-center justify-end mb-6">
            {!isAdding && (
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                Add Staff
              </button>
            )}
          </div>

          {success && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 text-emerald-800">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <p className="text-sm font-medium">{success}</p>
            </div>
          )}

          {isAdding && (
            <div className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Create New Staff User</h2>
                <button 
                  onClick={() => { setIsAdding(false); setError(''); }}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 p-3 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleAddStaff} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      required
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="e.g. Rahul Kumar"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="staff@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      required
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                    <input
                      required
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Repeat password"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 min-w-[140px]"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users List */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 font-medium">Name</th>
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-6 py-3 font-medium">Role</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedUsers.map(u => (
                      <tr key={u.uid} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{u.name}</td>
                        <td className="px-6 py-4 text-gray-600">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {u.active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {u.role === 'staff' && (
                            <button
                              onClick={() => handleToggleStatus(u.uid, u.active, u.role)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                u.active 
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              }`}
                            >
                              {u.active ? 'Disable' : 'Enable'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div className="p-8 text-center text-gray-500">No users found.</div>
                )}
              </div>
            )}
            
            {!loading && users.length > 0 && (
              <div className="border-t border-gray-200">
                <Pagination
                  currentPage={currentPage}
                  totalItems={users.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>

        </div>
    </AppLayout>
  );
}
