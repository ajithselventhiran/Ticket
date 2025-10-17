import { useEffect, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

const API = "http://localhost:5000";

export default function InputForm() {
  const [key, setKey] = useState(""); // Emp ID or Username
  const [emp, setEmp] = useState(null);
  const [form, setForm] = useState({ issue_text: "", reporting_to: "" });
  const [ip, setIp] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // 🧭 Get client IP
  useEffect(() => {
    axios
      .get(`${API}/api/ip`)
      .then((res) => setIp(res.data.ip || ""))
      .catch(() => setIp("Unavailable"));
  }, []);

  // 🧠 Auto-fetch employee when typing (debounce 500ms)
  useEffect(() => {
    if (!key.trim()) {
      setEmp(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API}/api/employees/find`, {
          params: { key },
        });
        setEmp(data);
        setForm((prev) => ({ ...prev, reporting_to: data.reporting_to || "" }));
        setMsg("");
      } catch {
        setEmp(null);
        setMsg("Employee not found");
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [key]);

  // 📨 Submit form
  const submitTicket = async (e) => {
    e.preventDefault();
    if (!emp) return setMsg("Please enter a valid employee.");
    if (!form.issue_text.trim())
      return setMsg("Please describe the issue before submitting.");
    if (!form.reporting_to.trim())
      return setMsg("Please select who you're reporting to.");

    try {
      setLoading(true);
      const payload = {
        emp_id: emp.emp_id,
        username: emp.username,
        full_name: emp.full_name,
        department: emp.department,
        reporting_to: form.reporting_to,
        issue_text: form.issue_text,
      };
      await axios.post(`${API}/api/tickets`, payload);
      setMsg("✅ Ticket submitted successfully and email sent!");
      setForm({ issue_text: "", reporting_to: "" });
      setKey("");
      setEmp(null);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Submit failed");
    } finally {
      setLoading(false);
    }
  };

  const reportingList = [
    "Murugan R",
    "Venkatesan K",
    "Nagarajan M",
    "Rajkumar",
  ];

  return (
    <div
      className="d-flex justify-content-center align-items-center min-vh-100"
      style={{
        background:
          "linear-gradient(135deg, #e3f2fd 0%, #f8fbff 50%, #e1f5fe 100%)",
      }}
    >
      <div
        className="card shadow-lg p-4"
        style={{ width: "650px", borderRadius: "20px" }}
      >
        <h3 className="text-center mb-3 text-primary fw-bold">
          Rapid Ticketing System
        </h3>
        <p className="text-center text-muted mb-4">
          System IP: <b>{ip || "-"}</b>
        </p>

        {/* 🔍 Employee Search */}
        <div className="card p-3 mb-4 border-0 bg-light shadow-sm">
          <div className="mb-3">
            <label className="form-label">Emp ID or Username</label>
            <input
              className="form-control"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g., EMP-1001 or prainila"
            />
          </div>

          {loading && <p className="text-secondary">⏳ Searching...</p>}

          {emp && (
            <div className="row g-3 mt-1">
              <div className="col-md-6">
                <label className="form-label">Full Name</label>
                <input className="form-control" value={emp.full_name} readOnly />
              </div>
              <div className="col-md-6">
                <label className="form-label">Emp ID</label>
                <input className="form-control" value={emp.emp_id} readOnly />
              </div>
              <div className="col-md-6">
                <label className="form-label">Username</label>
                <input className="form-control" value={emp.username} readOnly />
              </div>
              <div className="col-md-6">
                <label className="form-label">Department</label>
                <input className="form-control" value={emp.department} readOnly />
              </div>
            </div>
          )}
        </div>

        {/* 📝 Ticket Form */}
        <form className="p-2" onSubmit={submitTicket}>
          <div className="mb-3">
            <label className="form-label">Issue / Feedback</label>
            <textarea
              className="form-control"
              rows={4}
              value={form.issue_text}
              onChange={(e) =>
                setForm((s) => ({ ...s, issue_text: e.target.value }))
              }
              placeholder="Describe your issue or feedback..."
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Reporting To</label>
            <select
              className="form-select"
              value={form.reporting_to}
              onChange={(e) =>
                setForm((s) => ({ ...s, reporting_to: e.target.value }))
              }
              required
            >
              <option value="">-- Select Manager --</option>
              {reportingList.map((person, index) => (
                <option key={index} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-success w-100 fw-bold shadow-sm"
            disabled={loading || !emp}
          >
            {loading ? "Submitting..." : "Send Mail & Save"}
          </button>
        </form>

        {msg && (
          <div className="alert alert-info text-center mt-3 mb-0">{msg}</div>
        )}
      </div>
    </div>
  );
}
