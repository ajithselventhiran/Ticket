// ---------------------- Imports ----------------------
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// ---------------------- App setup ----------------------
const app = express();
app.use(cors());
app.use(express.json());
app.set("trust proxy", true); // so req.ip works behind proxies

// ---------------------- MySQL Connection ----------------------
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
});

// ✅ Test Database Connection (Alert in console)
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log("✅ MySQL Database Connected Successfully!");
    const [rows] = await conn.query("SELECT DATABASE() AS db;");
    console.log("📦 Using Database:", rows[0].db);
    conn.release();
  } catch (err) {
    console.error("❌ MySQL Database Connection Failed!");
    console.error("Error Details:", err.message);
    process.exit(1);
  }
})();

// ---------------------- Nodemailer Config ----------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE) === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ✅ Check Mail Transport once
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Mail Server Connection Failed:", error.message);
  } else {
    console.log("📧 Mail Server Ready to Send Emails");
  }
});

// ---------------------- Routes ----------------------

// Quick health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// 🔹 1) Find employee by emp_id or username
app.get("/api/employees/find", async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ message: "key is required" });

    const [rows] = await pool.query(
      `SELECT * FROM employees WHERE emp_id = ? OR username = ? LIMIT 1`,
      [key, key]
    );
    if (!rows.length)
      return res.status(404).json({ message: "Employee not found" });

    res.json(rows[0]);
  } catch (e) {
    console.error("❌ Error finding employee:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// 🔹 2) Get Client IP
app.get("/api/ip", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || req.ip || "")
    .toString()
    .split(",")[0]
    .trim();
  res.json({ ip });
});

// 🔹 3) Create ticket + send mail
app.post("/api/tickets", async (req, res) => {
  const {
    emp_id,
    username,
    full_name,
    department,
    reporting_to,
    issue_text,
  } = req.body || {};

  if (
    !emp_id ||
    !username ||
    !full_name ||
    !department ||
    !reporting_to ||
    !issue_text
  ) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const sys_ip = (req.headers["x-forwarded-for"] || req.ip || "")
    .toString()
    .split(",")[0]
    .trim();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO tickets 
      (emp_id, username, full_name, department, reporting_to, issue_text, system_ip)
      VALUES (?,?,?,?,?,?,?)`,
      [
        emp_id,
        username,
        full_name,
        department,
        reporting_to,
        issue_text,
        sys_ip,
      ]
    );

    await conn.commit();

    // ----- Send Email -----
    const mailHtml = `
      <div style="font-family:Arial, sans-serif; padding:10px; background:#f4f7fb;">
        <h2 style="color:#007bff;">Rapid Ticket Submitted</h2>
        <table style="border-collapse:collapse; width:100%; background:#fff;" border="1" cellpadding="8">
          <tr><td><b>Employee</b></td><td>${full_name} (${emp_id}, ${username})</td></tr>
          <tr><td><b>Department</b></td><td>${department}</td></tr>
          <tr><td><b>Reporting To</b></td><td>${reporting_to}</td></tr>
          <tr><td><b>System IP</b></td><td>${sys_ip}</td></tr>
          <tr><td><b>Issue</b></td><td>${(issue_text || "").replace(
            /\n/g,
            "<br/>"
          )}</td></tr>
          <tr><td><b>Time</b></td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <p style="margin-top:10px;">Thank you,<br/>Rapid Ticketing System</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.MAIL_TO, // can map by manager later
      subject: `New Ticket: ${full_name} (${emp_id})`,
      html: mailHtml,
    });

    console.log(`✅ Ticket saved & mail sent for ${full_name} (${emp_id})`);
    res.json({ ok: true, ip: sys_ip, message: "Ticket saved and mail sent" });
  } catch (e) {
    await conn.rollback();
    console.error("❌ Ticket Save/Email Error:", e.message);
    res.status(500).json({ message: "Failed to save/send" });
  } finally {
    conn.release();
  }
});

// ---------------------- Start Server ----------------------
const port = Number(process.env.PORT || 5000);
app.listen(port, () => {
  console.log(`🚀 API running on http://localhost:${port}`);
});
