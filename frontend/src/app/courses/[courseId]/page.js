"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "../../AuthContext";
import { fetchAPI } from "../../../lib/api";

export default function SingleCoursePage() {
  const params = useParams();
  const courseId = params.courseId;
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("assignments");
  const [assignments, setAssignments] = useState([]);
  const [roster, setRoster] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [asgnTitle, setAsgnTitle] = useState("");
  const [asgnDueDate, setAsgnDueDate] = useState("");
  const [asgnFile, setAsgnFile] = useState(null);
  const [enrolEmail, setEnrolEmail] = useState("");
  const [enrolRole, setEnrolRole] = useState("student");

  useEffect(() => {
    if (user) {
      loadAssignments();
      if (user.role === 'instructor') {
        loadRoster(); 
      }
    }
  }, [user, courseId]);

  const loadAssignments = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAPI(`/courses/${courseId}/assignments`, 'GET');
      setAssignments(data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load assignments from the database.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!asgnFile) return setError("Please attach a .zip file for the assignment.");

    try {
      const formData = new FormData();
      formData.append('title', asgnTitle);
      formData.append('due_date', asgnDueDate);
      formData.append('file', asgnFile);

      const newAssignment = await fetchAPI(`/courses/${courseId}/assignments`, 'POST', formData, true);
      setAssignments([...assignments, newAssignment]);
      setSuccessMsg("Assignment created successfully!");
      setAsgnTitle("");
      setAsgnDueDate("");
      setAsgnFile(null);

      document.getElementById('file-upload').value = ""; 
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEnrollUser = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    try {
      await fetchAPI(`/courses/${courseId}/enroll`, 'POST', {
        email: enrolEmail,
        role: enrolRole
      });
      
      setSuccessMsg(`Successfully enrolled ${enrolEmail} as a ${enrolRole}!`);
      setEnrolEmail("");
    } catch (err) {
      setError(err.message);
    }
  };

  const loadRoster = async () => {
    try {
      const data = await fetchAPI(`/courses/${courseId}/roster`, 'GET');
      setRoster(data || []);
    } catch (err) {
      console.error("Failed to load roster:", err);
    }
  };
  
  if (!user) return <div className="text-center mt-20">Please log in.</div>;

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <Link href="/courses" className="text-sm text-blue-500 hover:underline mb-2 inline-block">Back to Courses</Link>
        <h1 className="text-3xl font-bold text-gray-800">Course Detail:</h1>

        {user.role === 'instructor' && (
          <div className="flex space-x-6 mt-4">
            <button onClick={() => { setActiveTab("assignments"); setError(""); setSuccessMsg(""); }} className={`pb-2 text-sm font-bold border-b-2 ${activeTab === "assignments" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>Assignments</button>
            <button onClick={() => { setActiveTab("roster"); setError(""); setSuccessMsg(""); }} className={`pb-2 text-sm font-bold border-b-2 ${activeTab === "roster" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>Roster & Enrollment</button>
          </div>
        )}
      </div>

      {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded border border-red-200">{error}</div>}
      {successMsg && <div className="p-3 text-sm text-green-700 bg-green-100 rounded border border-green-200">{successMsg}</div>}

      <div className={`grid grid-cols-1 ${user.role === 'instructor' ? 'lg:grid-cols-3' : ''} gap-8`}>
        {activeTab === "assignments" && (
          <>
            {user.role === 'instructor' && (
              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h2 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">Create Assignment</h2>
                  <form onSubmit={handleCreateAssignment} className="space-y-4">
                    <input type="text" value={asgnTitle} onChange={(e)=>setAsgnTitle(e.target.value)} placeholder="Title" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500" required />
                    <input type="datetime-local" value={asgnDueDate} onChange={(e)=>setAsgnDueDate(e.target.value)} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500" required />
                    <input id="file-upload" type="file" accept=".zip" onChange={(e)=>setAsgnFile(e.target.files[0])} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" required />
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded mt-2 hover:bg-blue-700">Submit</button>
                  </form>
                </div>
              </div>
            )}

            <div className={`${user.role === 'instructor' ? 'lg:col-span-2' : ''} space-y-4`}>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">{user.role === 'student' ? 'Available Assignments' : 'Course Assignments'}</h2>
                {isLoading && <span className="text-sm text-blue-500 animate-pulse">Loading...</span>}
              </div>
              
              {assignments.length === 0 && !isLoading ? (
                <p className="text-gray-500 bg-gray-50 p-4 rounded border border-dashed">No assignments posted yet.</p>
              ) : (
                assignments.map(asgn => (
                  <div key={asgn.id} className="bg-white p-5 rounded-lg border shadow-sm flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{asgn.title}</h3>
                      <p className="text-sm text-gray-500">Due: {new Date(asgn.due_date || asgn.dueDate).toLocaleString()}</p>
                    </div>
                    <Link href={`/courses/${courseId}/assignments/${asgn.id}`} className="bg-blue-50 text-blue-600 font-semibold py-2 px-4 rounded hover:bg-blue-100 border border-blue-200">
                      {user.role === 'student' ? 'Submit Work' : 'Manage & Analyze'}
                    </Link>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === "roster" && user.role === 'instructor' && (
          <>
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">Enroll User</h2>
                <form onSubmit={handleEnrollUser} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User Email</label>
                    <input type="email" value={enrolEmail} onChange={(e) => setEnrolEmail(e.target.value)} placeholder="student@example.com" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select value={enrolRole} onChange={(e) => setEnrolRole(e.target.value)} className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-blue-500">
                      <option value="student">Student</option>
                      <option value="instructor">Instructor</option>
                      {/*<option value="ta">TA</option> Add during later phase*/}
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 mt-2">Submit Enrollment</button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-bold text-gray-800">Enrolled Users</h2>
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="p-4 text-sm font-medium text-gray-500 uppercase">Email</th>
                      <th className="p-4 text-sm font-medium text-gray-500 uppercase">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.length === 0 ? (
                      <tr><td colSpan="2" className="p-4 text-gray-500">Roster data unavailable (Requires GET endpoint).</td></tr>
                    ) : (
                      roster.map(u => (
                        <tr key={u.id} className="border-b hover:bg-gray-50">
                          <td className="p-4 text-gray-800 font-medium">{u.email}</td>
                          <td className="p-4">
                            <span className="px-2 py-1 text-xs font-bold rounded-full bg-gray-200 text-gray-800">{u.role.toUpperCase()}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}