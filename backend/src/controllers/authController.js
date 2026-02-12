import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { z } from 'zod';
import { query } from '../db.js';

dotenv.config();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function login(req, res) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const rows = await query('SELECT user_id, role, email, password_hash, display_name FROM users WHERE email=?', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { user_id: user.user_id, role: user.role, email: user.email, display_name: user.display_name },
      process.env.JWT_SECRET || 'change_me',
      { expiresIn: '12h' }
    );

    res.json({ token, user: { user_id: user.user_id, role: user.role, email: user.email, display_name: user.display_name } });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: 'Validation error', details: e.issues });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
}

const createUserSchema = z.object({
  role: z.enum(['admin','teacher','student']),
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(1).optional(),
  student_no: z.string().min(1).optional(),
  teacher_id: z.string().min(1).optional(),
  department: z.string().optional(),
  batch: z.string().optional(),
  course_name: z.string().optional()
});

export async function createUser(req, res) {
  try {
    const data = createUserSchema.parse(req.body);

    const hash = await bcrypt.hash(data.password, 10);
    const result = await query(
      'INSERT INTO users (role, email, password_hash, display_name) VALUES (?,?,?,?)',
      [data.role, data.email, hash, data.display_name || null]
    );
    const userId = result.insertId;

    if (data.role === 'student') {
      if (!data.student_no) return res.status(400).json({ error: 'student_no is required for students' });
      await query(
        'INSERT INTO students (student_no, user_id, batch, course_name, department) VALUES (?,?,?,?,?)',
        [data.student_no, userId, data.batch || null, data.course_name || null, data.department || null]
      );
    }

    if (data.role === 'teacher') {
      if (!data.teacher_id) return res.status(400).json({ error: 'teacher_id is required for teachers' });
      await query(
        'INSERT INTO teachers (teacher_id, user_id, teacher_mail, department) VALUES (?,?,?,?)',
        [data.teacher_id, userId, data.email, data.department || null]
      );
    }

    if (data.role === 'admin') {
      await query(
        'INSERT INTO administrators (admin_id, user_id, admin_name, email, department) VALUES (?,?,?,?,?)',
        [`ADMIN-${userId}`, userId, data.display_name || null, data.email, data.department || null]
      );
    }

    res.status(201).json({ ok: true, user_id: userId });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: 'Validation error', details: e.issues });
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already exists' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function me(req, res) {
  res.json({ user: req.user });
}
