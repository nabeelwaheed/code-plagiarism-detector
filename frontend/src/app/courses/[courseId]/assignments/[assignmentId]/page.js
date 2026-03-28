"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../AuthContext"; 
import { fetchAPI } from "../../../../../lib/api"; 

export default function AssignmentHubPage() {
  const params = useParams();
  const router = useRouter();
  const { courseId, assignmentId } = params;
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [tmplVersion, setTmplVersion] = useState("1");
  const [tmplFile, setTmplFile] = useState(null);
  const [subFile, setSubFile] = useState(null);
  const [jobTemplateId, setJobTemplateId] = useState("");
  const [jobParams, setJobParams] = useState('{\n  "threshold_primary": 0.85,\n  "k_gram": 5,\n  "window": 10\n}');
  const [isEngineRunning, setIsEngineRunning] = useState(false);

  useEffect(() => {
    if (user && user.role === 'instructor') {
      loadHubData();
    } else {
      setIsLoading(false); 
    }
  }, [user, courseId, assignmentId]);

  const loadHubData = async () => {
    setIsLoading(true);
    try {
      const [fetchedTemplates, fetchedSubmissions] = await Promise.all([
        fetchAPI(`/courses/${courseId}/assignments/${assignmentId}/template`, 'GET'),
        fetchAPI(`/courses/${courseId}/assignments/${assignmentId}/submit`, 'GET')
      ]);
      setTemplates(fetchedTemplates || []);
      setSubmissions(fetchedSubmissions || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load hub data.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccessMsg("");
    if (!subFile) return setError("Please attach your .zip submission.");

    try {
      const formData = new FormData();
      formData.append('email', user.email);
      formData.append('submission_date', new Date().toISOString());
      formData.append('metadata', '{}');
      formData.append('file', subFile);

      await fetchAPI(`/courses/${courseId}/assignments/${assignmentId}/submit`, 'POST', formData, true);
      setSuccessMsg("Your assignment has been submitted successfully!");
      setSubFile(null);
      document.getElementById('student-upload').value = "";
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTemplateSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccessMsg("");
    if (!tmplFile) return setError("Please attach a .zip template.");

    try {
      const formData = new FormData();
      formData.append('version', tmplVersion);
      formData.append('file', tmplFile);

      await fetchAPI(`/courses/${courseId}/assignments/${assignmentId}/template`, 'POST', formData, true);
      setSuccessMsg("Template uploaded successfully!");
      setTmplFile(null);
      document.getElementById('template-upload').value = "";
      await loadHubData(); 

    } catch (err) {
      setError(err.message);
    }
  };

  const handleTriggerJob = async (e) => {
    e.preventDefault();
    setError(""); setSuccessMsg("");
    setIsEngineRunning(true);
    try {
      let parsedParams = {};
      try { 
        parsedParams = JSON.parse(jobParams); 
      } catch (e) { 
        throw new Error("Invalid JSON in parameters."); 
      }

      const response = await fetchAPI(`/courses/${courseId}/assignments/${assignmentId}/analyze`, 'POST', {
        templateId: jobTemplateId || null,
        language: 'cpp',
        params: parsedParams
      });

      setSuccessMsg("Engine analysis complete! Redirecting to results...");
      setTimeout(() => {
        const jobId = response.result?.job?.id || response.jobId;
        if (jobId) {
          router.push(`/jobs/${jobId}/results`);
        } else {
          router.push(`/jobs`);
        }
      }, 1500);

    } catch (err) {
      setError(`Engine Error: ${err.message}`);
    } finally {
      setIsEngineRunning(false);
    }
  };

  if (!user) return <div className="text-center mt-20">Please log in.</div>;

  if (user.role === 'student') {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="border-b pb-4">
          <Link href={`/courses/${courseId}`} className="text-sm text-blue-500 hover:underline mb-2 inline-block">Back to Course</Link>
          <h1 className="text-3xl font-bold text-gray-800">Submit Assignment:</h1>
        </div>
        
        {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded border border-red-200">{error}</div>}
        {successMsg && <div className="p-3 text-sm text-green-700 bg-green-100 rounded border border-green-200">{successMsg}</div>}

        <div className="bg-white p-6 rounded-lg shadow-sm border border-green-100">
          <h2 className="text-lg font-bold mb-4 text-green-800 border-b pb-2">Upload Your Submission (.zip)</h2>
          <form onSubmit={handleStudentSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select File</label>
              <input id="student-upload" type="file" accept=".zip" onChange={(e) => setSubFile(e.target.files[0])} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:bg-green-50 file:text-green-700" required />
            </div>
            <button type="submit" className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700">Submit Work</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="border-b pb-4">
        <Link href={`/courses/${courseId}`} className="text-sm text-blue-500 hover:underline mb-2 inline-block">Back to Course</Link>
        <h1 className="text-3xl font-bold text-gray-800">Instructor Hub:</h1>
      </div>

      {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded border border-red-200">{error}</div>}
      {successMsg && <div className="p-3 text-sm text-green-700 bg-green-100 rounded border border-green-200">{successMsg}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-purple-100">
            <h2 className="text-lg font-bold mb-4 text-purple-800 border-b pb-2">1. Upload Base Template</h2>
            <form onSubmit={handleTemplateSubmit} className="space-y-4">
              <input type="text" value={tmplVersion} onChange={(e) => setTmplVersion(e.target.value)} placeholder="Version (e.g., 1)" className="w-full p-2 border rounded focus:ring-purple-500" required />
              <input id="template-upload" type="file" accept=".zip" onChange={(e) => setTmplFile(e.target.files[0])} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:bg-purple-50 file:text-purple-700" required />
              <button type="submit" className="w-full bg-purple-600 text-white font-bold py-2 px-4 rounded hover:bg-purple-700">Upload Template</button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h2 className="text-lg font-bold text-gray-800">Student Submissions</h2>
              {isLoading && <span className="text-sm text-blue-500 animate-pulse">Loading...</span>}
            </div>
            
            <ul className="space-y-3">
              {submissions.length === 0 && !isLoading ? (
                <li className="text-gray-500 text-sm">No submissions yet.</li>
              ) : (
                submissions.map(sub => (
                  <li key={sub.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border">
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{sub.email || `Student ID: ${sub.student_id}`}</p>
                      <p className="text-xs text-gray-500">Submitted: {new Date(sub.submission_date).toLocaleDateString()}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
        
        <div>
          <div className="bg-white p-6 rounded-lg shadow-md border-2 border-blue-200">
            <h2 className="text-xl font-bold mb-4 text-blue-800 border-b pb-2">2. Trigger Batch Analysis</h2>
            <p className="text-sm text-gray-600 mb-4">This will compare all student submissions against each other and the template.</p>
            
            <form onSubmit={handleTriggerJob} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Template (Optional)</label>
                <select value={jobTemplateId} onChange={(e) => setJobTemplateId(e.target.value)} className="w-full p-2 border rounded bg-white focus:ring-blue-500">
                  <option value="">-- No Template --</option>
                  {templates.map((t, index) => <option key={t.id || `tmpl-${index}`} value={t.id || t.template_id || t.version}>Version {t.version}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Engine Parameters (JSON)</label>
                <textarea value={jobParams} onChange={(e) => setJobParams(e.target.value)} rows="5" className="w-full p-2 border rounded focus:ring-blue-500 font-mono text-sm bg-gray-50"></textarea>
              </div>

              <button 
                type="submit" 
                disabled={isEngineRunning || submissions.length < 2}
                className={`w-full text-white font-bold py-3 px-4 rounded shadow transition-colors mt-4 text-lg 
                  ${submissions.length < 2 ? 'bg-gray-400 cursor-not-allowed' : 
                    isEngineRunning ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {submissions.length < 2 ? 'Need 2+ Submissions' : 
                 isEngineRunning ? 'Running Analysis...' : 'Run Engine Analysis'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}