"use client";
import Link from "next/link";
import { useState } from "react";
import { fetchAPI } from "../../../lib/api";
import { useAuth } from "../../AuthContext";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");

  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
  
    try {
      ////Will determine route based on selected role
      const endpoint = role === 'instructor' ? '/users/registerI' : '/users/register';
      const data = await fetchAPI(endpoint, 'POST', { name, email, password, role });
    
      login(data.user || data, data.token || data.id);
      router.push('/dashboard');
    
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center h-full py-10">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md border">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">Create an Account</h2>
        {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded">{error}</div>}
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              placeholder="student@example.com"
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
            </select>
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 transition-colors mt-4"
          >
            Register
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-600">
          Already have an account? <Link href="/login" className="text-blue-500 hover:underline">Login here</Link>
        </p>
      </div>
    </div>
  );
}