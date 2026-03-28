"use client";
import Link from "next/link";
import { useState } from "react";
import { fetchAPI } from "../../../lib/api";
import { useAuth } from "../../AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { setUser } = useAuth();
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const handleLogin = async (e) => {
  e.preventDefault();
  setError("");
  
  try {
    const data = await fetchAPI('/users/login', 'POST', { email, password });
    
    login(data.user || data, data.token || data.id);
    router.push('/dashboard');
    
  } catch (err) {
    setError(err.message);
  }
};

  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md border">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">Login to SimEngine</h2>
        {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              placeholder="instructor@example.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition-colors mt-4"
          >
            Login
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-600">
          Don't have an account? <Link href="/register" className="text-blue-500 hover:underline">Register here</Link>
        </p>
      </div>
    </div>
  );
}