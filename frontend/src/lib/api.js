const API_BASE = 'http://localhost:3000/api';

export async function fetchAPI(endpoint, method = 'GET', body = null, isFormData = false) {
  const headers = {};
  
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const token = localStorage.getItem('authToken');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-User-Id'] = token; 
  }

  const options = { method, headers };
  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const rawText = await response.text();
  let data;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (err) {
    data = { message: rawText };
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || `API Error: ${response.status}`);
  }
  return data;
}