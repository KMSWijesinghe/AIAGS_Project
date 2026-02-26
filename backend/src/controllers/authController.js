import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { z } from "zod";
import { query } from "../db.js";

dotenv.config();

// ✅ Allow netId OR email (do NOT use .email() here)
const loginSchema = z.object({
  email: z.string().min(1),       // can be "mf_fw_test" OR "mf_fw_test@kln.ac.lk"
  password: z.string().min(1),
});

const createUserSchema = z.object({
  role: z.enum(["admin", "teacher", "student"]),
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(1).optional(),
  student_no: z.string().min(1).optional(),
  teacher_id: z.string().min(1).optional(),
  department: z.string().optional(),
  batch: z.string().optional(),
  course_name: z.string().optional(),
});

function signToken(user, extra = {}) {
  return jwt.sign(
    {
      user_id: user.user_id,
      role: user.role,
      email: user.email,
      display_name: user.display_name,
      ...extra,
    },
    process.env.JWT_SECRET || "change_me",
    { expiresIn: "12h" }
  );
}

/**
 * POST /api/auth/login
 * Supports:
 *  - netId login (e.g., "mf_fw_test") -> university auth
 *  - university email login (e.g., "mf_fw_test@kln.ac.lk") -> university auth
 *  - local admin/teacher login using DB password_hash
 */
export async function login(req, res) {
  try {
    const { email: rawEmailOrNetId, password } = loginSchema.parse(req.body);

    const input = rawEmailOrNetId.trim();

    // ✅ netId derived from either "netid" or "netid@domain"
    const netId = input.includes("@") ? input.split("@")[0].trim() : input;

    // ✅ Create a stable "full email" to store/search in DB for university users
    // Choose your official domain here:
    const fullEmail = input.includes("@") ? input : `${netId}@kln.ac.lk`;

    // ✅ Decide whether to use university auth
    // If user typed just netId -> university auth
    // If user typed @kln.ac.lk or @medicine.kln.ac.lk -> university auth
    const isUniversityLogin =
      !input.includes("@") ||
      input.endsWith("@kln.ac.lk") ||
      input.endsWith("@medicine.kln.ac.lk");

    // --------------------------------------------
    // 1) University auth path
    // --------------------------------------------
    if (isUniversityLogin) {
      const payload = {
        req_type: "log",
        netId,
        password,
      };

      let uniData;
      try {
        const response = await fetch(
          "https://systems.medicine.kln.ac.lk/logsc/login.php",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        const text = await response.text();
        try {
          uniData = text ? JSON.parse(text) : {};
        } catch {
          return res.status(502).json({
            error: "University auth returned invalid response",
            raw: text,
          });
        }
      } catch (e) {
        console.error("University auth fetch error:", e);
        return res.status(502).json({ error: "University auth system error" });
      }

      if (uniData?.loginStatus !== true) {
        return res
          .status(401)
          .json({ error: uniData?.message || "Invalid credentials" });
      }

      const stdNo = uniData?.stdNo || null;

      // 2) Find or create local user (use fullEmail!)
      const existing = await query(
        "SELECT user_id, role, email, display_name FROM users WHERE email=?",
        [fullEmail]
      );
      let user = existing[0];

      if (!user) {
        const dummyHash = await bcrypt.hash("UNIVERSITY_AUTH_ONLY", 10);

        const ins = await query(
          "INSERT INTO users (role, email, password_hash, display_name) VALUES (?,?,?,?)",
          ["student", fullEmail, dummyHash, null]
        );
        const userId = ins.insertId;

        await query("INSERT INTO students (student_no, user_id) VALUES (?,?)", [
          stdNo || `STD-${userId}`,
          userId,
        ]);

        const after = await query(
          "SELECT user_id, role, email, display_name FROM users WHERE user_id=?",
          [userId]
        );
        user = after[0];
      }

      const token = signToken(user, { stdNo });

      return res.json({
        token,
        user: {
          user_id: user.user_id,
          role: user.role,
          email: user.email, // this will be fullEmail
          display_name: user.display_name,
          stdNo,
        },
      });
    }

    // --------------------------------------------
    // 2) Local login path (admin/teacher)
    // --------------------------------------------
    // Local users MUST login using real email stored in DB
    // If someone typed netId here, it will not match DB and fail (expected)
    const rows = await query(
      "SELECT user_id, role, email, password_hash, display_name FROM users WHERE email=?",
      [input]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    if (!user.password_hash) {
      return res.status(401).json({ error: "Use university login for this account" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    const token = signToken(user);

    return res.json({
      token,
      user: {
        user_id: user.user_id,
        role: user.role,
        email: user.email,
        display_name: user.display_name,
      },
    });
  } catch (e) {
    if (e?.issues) {
      return res.status(400).json({ error: "Validation error", details: e.issues });
    }
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function createUser(req, res) {
  try {
    const data = createUserSchema.parse(req.body);

    const hash = await bcrypt.hash(data.password, 10);
    const result = await query(
      "INSERT INTO users (role, email, password_hash, display_name) VALUES (?,?,?,?)",
      [data.role, data.email, hash, data.display_name || null]
    );
    const userId = result.insertId;

    if (data.role === "student") {
      if (!data.student_no)
        return res.status(400).json({ error: "student_no is required for students" });

      await query(
        "INSERT INTO students (student_no, user_id, batch, course_name, department) VALUES (?,?,?,?,?)",
        [
          data.student_no,
          userId,
          data.batch || null,
          data.course_name || null,
          data.department || null,
        ]
      );
    }

    if (data.role === "teacher") {
      if (!data.teacher_id)
        return res.status(400).json({ error: "teacher_id is required for teachers" });

      await query(
        "INSERT INTO teachers (teacher_id, user_id, teacher_mail, department) VALUES (?,?,?,?)",
        [data.teacher_id, userId, data.email, data.department || null]
      );
    }

    if (data.role === "admin") {
      await query(
        "INSERT INTO administrators (admin_id, user_id, admin_name, email, department) VALUES (?,?,?,?,?)",
        [`ADMIN-${userId}`, userId, data.display_name || null, data.email, data.department || null]
      );
    }

    return res.status(201).json({ ok: true, user_id: userId });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: "Validation error", details: e.issues });
    if (e?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email already exists" });
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function me(req, res) {
  return res.json({ user: req.user });
}