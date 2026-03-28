"use client";
import Link from "next/link";
import { useAuth } from "../AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) {
    return <div className="text-center mt-20 text-gray-600">Please <Link href="/login" className="text-blue-500 underline">log in</Link> to view your dashboard.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Welcome, {user.name}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/courses" className="block p-6 bg-white border rounded-xl shadow-sm hover:shadow-md hover:border-blue-400 transition-all group">
          <h2 className="text-xl font-bold text-blue-600 mb-2 group-hover:text-blue-700">Course Management</h2>
          <p className="text-gray-600 text-sm">
            {user.role === 'instructor' ? 'Create courses, manage rosters, and set up assignment templates.' : 'Access your enrolled courses and submit assignments.'}
          </p>
        </Link>

        {user.role === 'instructor' && (
          <Link href="/jobs" className="block p-6 bg-white border rounded-xl shadow-sm hover:shadow-md hover:border-purple-400 transition-all group">
            <h2 className="text-xl font-bold text-purple-600 mb-2 group-hover:text-purple-700">Analysis Jobs</h2>
            <p className="text-gray-600 text-sm">View all historical engine runs, check statuses, and review similarity matrices.</p>
          </Link>
        )}
      </div>
    </div>
  );
}