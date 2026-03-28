"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { fetchAPI } from "../../lib/api";

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [term, setTerm] = useState("");
  const [isActive, setIsActive] = useState("true");

  useEffect(() => {
    if (user) {
      loadCourses();
    }
  }, [user]);

  const loadCourses = async () => {
    setIsLoading(true);
    try {
      const endpoint = user.role === 'student' ? '/enrollments/my-courses' : '/courses';
      const data = await fetchAPI(endpoint, 'GET');
      setCourses(data || []);
    } catch (err) {
      console.error("Failed to fetch courses:", err);
      setError("Could not load courses.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const payload = {
        course_code: courseCode,
        term: term,
        is_active: isActive === "true"
      };

      const newCourse = await fetchAPI('/courses', 'POST', payload);
      setCourses([...courses, newCourse]);
      setCourseCode("");
      setTerm("");
      setIsActive("true");
    } catch (err) {
      setError(err.message);
    }
  };

  if (!user) return <div className="text-center mt-20">Please log in to view courses.</div>;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Course Management</h1>

      {error && (
        <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className={`grid grid-cols-1 ${user.role === 'instructor' ? 'lg:grid-cols-3' : ''} gap-8`}>
        {user.role === 'instructor' && (
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">Create New Course</h2>
              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Course Code</label>
                  <input 
                    type="text" 
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. CS101" 
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                  <input 
                    type="text" 
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="e.g. Fall 2026" 
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select 
                    value={isActive}
                    onChange={(e) => setIsActive(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 transition-colors mt-2">
                  Create Course
                </button>
              </form>
            </div>
          </div>
        )}

        <div className={`${user.role === 'instructor' ? 'lg:col-span-2' : ''} space-y-4`}>
          <div className="flex justify-between items-center border-b pb-2 mb-4">
            <h2 className="text-xl font-bold text-gray-800">My Courses</h2>
            {isLoading && <span className="text-sm text-blue-500 font-semibold animate-pulse">Loading database...</span>}
          </div>

          <div className={`grid grid-cols-1 ${user.role === 'student' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
            {courses.length === 0 && !isLoading ? (
              <p className="text-gray-500">No courses found in the database.</p>
            ) : (
              courses.map(course => (
                <div key={course.id} className={`p-5 rounded-lg border shadow-sm ${course.is_active ? 'bg-white' : 'bg-gray-50 opacity-75'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-blue-600">{course.course_code}</h3>
                    <span className={`text-xs px-2 py-1 rounded font-bold ${course.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {course.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-4">{course.term}</p>
                  <div className="border-t pt-3 mt-3 text-right">
                    <Link href={`/courses/${course.id}`} className="text-sm font-semibold text-blue-500 hover:text-blue-700 hover:underline">
                      View Course
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}