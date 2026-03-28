"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { fetchAPI } from "../../lib/api";

export default function GlobalJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAPI('/analysis/jobs', 'GET');
      setJobs(Array.isArray(data) ? data : (data.jobs || []));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-800">Analysis Jobs</h1>
        <button onClick={loadJobs} className="bg-blue-50 text-blue-600 px-4 py-2 rounded font-semibold border border-blue-200 hover:bg-blue-100">
          Refresh List
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b text-sm text-gray-500 uppercase tracking-wider">
              <th className="p-4 font-medium">Job ID</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {isLoading ? (
              <tr><td colSpan="3" className="p-4 text-center text-blue-500 animate-pulse">Loading jobs...</td></tr>
            ) : jobs.length === 0 ? (
              <tr><td colSpan="3" className="p-4 text-center text-gray-500">No analysis jobs found</td></tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-mono text-sm text-blue-600">
                    {job.id}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${job.status?.toLowerCase() === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {job.status ? job.status.toUpperCase() : 'UNKNOWN'}
                    </span>
                  </td>
                  <td className="p-4">
                    {job.status?.toLowerCase() === 'completed' || job.status?.toLowerCase() === 'pending' ? (
                      <Link href={`/jobs/${job.id}/results`} className="text-blue-600 font-semibold hover:underline">
                        View Pairs
                      </Link>
                    ) : (
                      <span className="text-gray-400 text-sm">Unavailable</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}