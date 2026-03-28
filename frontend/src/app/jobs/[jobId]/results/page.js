"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { fetchAPI } from "../../../../lib/api"; 

export default function ResultsMatrixPage() {
  const params = useParams();
  const jobId = params.jobId;
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (jobId) loadResults();
  }, [jobId]);

  const loadResults = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchAPI(`/analysis/jobs/${jobId}`, 'GET');
      const uniquePairs = [];
      const seenIds = new Set();
      for (const row of data) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          uniquePairs.push(row);
        }
      }
      setResults(uniquePairs);
    } catch (err) {
      console.error(err);
      setError("Failed to load analysis results. The job might still be running or doesn't exist.");
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (scoreDecimal) => {
    const percentage = parseFloat(scoreDecimal) * 100;
    if (percentage >= 90) return "bg-red-100 text-red-800 border-red-200";
    if (percentage >= 75) return "bg-orange-100 text-orange-800 border-orange-200";
    if (percentage >= 50) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-green-100 text-green-800 border-green-200";
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4 flex justify-between items-end">
        <div>
          <Link href="/jobs" className="text-sm text-blue-500 hover:underline mb-2 inline-block">
            Back to Analysis Jobs
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">
            Analysis Results:
          </h1>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>Status: <span className="ml-2 font-semibold text-green-600">COMPLETED</span></p>
        </div>
      </div>

      {error && <div className="p-4 text-sm text-red-700 bg-red-100 rounded border border-red-200">{error}</div>}

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-700">Similarity Pairs Found</h2>
          <button onClick={loadResults} className="text-sm text-blue-600 hover:underline">
            Refresh Results
          </button>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b text-sm text-gray-500 uppercase tracking-wider">
              <th className="p-4 font-medium">Comparison</th>
              <th className="p-4 font-medium">Similarity Score</th>
              <th className="p-4 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {isLoading ? (
              <tr><td colSpan="3" className="p-8 text-center text-blue-500 font-semibold animate-pulse">Fetching results from PostgreSQL...</td></tr>
            ) : results.length === 0 ? (
              <tr><td colSpan="3" className="p-8 text-center text-gray-500">No similarities found.</td></tr>
            ) : (
              results.map((pair) => {
                const rawScore = pair.score_primary || pair.score || pair.similarity_score || 0;
                const percentage = (parseFloat(rawScore) * 100).toFixed(1);
                
                return (
                  <tr key={pair.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-sm font-medium text-gray-800">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-blue-700 bg-blue-50 px-2 py-1 rounded">
                          Source A
                        </span>
                        <span className="text-gray-400">vs</span>
                        <span className="font-mono text-purple-700 bg-purple-50 px-2 py-1 rounded">
                          Source B
                        </span>
                        {/*(ID: {pair.submission_b_id || pair.b_id || 'Unknown'})*/}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 text-sm font-bold border rounded ${getScoreColor(rawScore)}`}>
                        {percentage}%
                      </span>
                    </td>
                    <td className="p-4">
                      <Link 
                        href={`/compare?jobId=${jobId}&pairId=${pair.id}`} 
                        className="bg-gray-800 text-white text-sm font-semibold py-1.5 px-3 rounded hover:bg-gray-700 transition-colors inline-block"
                      >
                        View Difference
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}