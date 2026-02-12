// Minimal API helper for AIGS frontend
// Stores JWT in localStorage under key "aigs_token".

const BASE = "";

async function request(path, opts = {}) {
  const token = localStorage.getItem("aigs_token");

  const headers = {
    ...(opts.headers || {}),
  };

  // Add JSON header only when body is not FormData
  if (!(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // ✅ Add auth header
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(BASE + path, { ...opts, headers });

  // Handle non-OK
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.error || data?.message || `Request failed: ${res.status}`;
    throw new Error(msg);
  }

  return data;
}


export const api = {
  auth: {
    login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => apiFetch('/auth/me')
  },

  courses: {
    list: () => request("/api/courses")
  },

  batches: {
    list: ({ course_name } = {}) =>
      request(`/api/batches${course_name ? `?course_name=${encodeURIComponent(course_name)}` : ""}`)
  },

  assignments: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/api/assignments${q ? `?${q}` : ""}`);
    },
    create: (payload) =>
      request("/api/assignments", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) =>
      request(`/api/assignments/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    remove: (id) =>
      request(`/api/assignments/${id}`, { method: "DELETE" }),
  },


  rubrics: {
    byAssignment: (assignmentId) => apiFetch(`/rubrics/assignment/${assignmentId}`),
    create: (payload) => apiFetch('/rubrics', { method: 'POST', body: JSON.stringify(payload) })
  },

  portfolios: {
    list: ({ assignment_id } = {}) => {
      const qs = new URLSearchParams();
      if (assignment_id) qs.set("assignment_id", assignment_id);
      return request(`/api/portfolios?${qs.toString()}`);
    },

    upload: ({ student_no, assignment_id, file }) => {
      const fd = new FormData();
      fd.append("student_no", student_no);
      fd.append("assignment_id", assignment_id);
      fd.append("file", file);

      // IMPORTANT: request() already avoids setting Content-Type for FormData
      return request("/api/portfolios/upload", {
        method: "POST",
        body: fd,
      });
    },
  },
  grading: {
    gradePortfolioAI: (portfolioId) => apiFetch(`/grading/portfolio/${portfolioId}/ai`, { method: 'POST' }),
    gradeAssignmentAI: (assignmentId) => apiFetch(`/grading/assignment/${assignmentId}/ai`, { method: 'POST' }),
    resultsByAssignment: (assignmentId) => apiFetch(`/grading/assignment/${assignmentId}/results`),
    setFinal: (portfolioId, payload) => apiFetch(`/grading/portfolio/${portfolioId}/final`, { method: 'POST', body: JSON.stringify(payload) }),
    publishAssignment: (assignmentId) => apiFetch(`/grading/assignment/${assignmentId}/publish`, { method: 'POST' })
  }
};
