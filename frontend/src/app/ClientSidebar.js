"use client";
import Link from 'next/link';
import { useAuth } from './AuthContext';

export default function ClientSidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-white border-r shadow-sm flex flex-col">
      <div className="p-6 border-b">
        <Link href="/" className="text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors">
          AVEngine
        </Link>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/dashboard" className="block px-4 py-2 rounded-md hover:bg-gray-100 font-medium">Dashboard</Link>
        <Link href="/courses" className="block px-4 py-2 rounded-md hover:bg-gray-100 font-medium">Courses</Link>
        
        {user?.role === 'instructor' && (
          <Link href="/jobs" className="block px-4 py-2 rounded-md hover:bg-gray-100 font-medium">Analysis Jobs</Link>
        )}

        <div className="pt-4 mt-4 border-t border-gray-100 space-y-2">
          {user ? (
            <div className="px-4 py-2 bg-gray-50 rounded-md border">
              <p className="text-sm font-bold text-gray-800">{user.name}</p>
              <p className="text-xs text-gray-500 capitalize mb-2">{user.role}</p>
              <button onClick={() => logout()} className="text-sm text-red-500 hover:underline font-semibold">Logout</button>
            </div>
          ) : (
            <>
              <Link href="/login" className="block px-4 py-2 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 font-semibold transition-colors">
                Login
              </Link>
              <Link href="/register" className="block px-4 py-2 text-green-600 bg-green-50 rounded-md hover:bg-green-100 font-semibold transition-colors">
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </aside>
  );
}