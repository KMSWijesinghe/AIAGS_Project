import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import assignmentRoutes from './routes/assignments.js';
import rubricRoutes from './routes/rubrics.js';
import portfolioRoutes from './routes/portfolios.js';
import gradingRoutes from './routes/grading.js';
import metaRoutes from "./routes/metaRoutes.js";


dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// serve static frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');
app.use('/', express.static(frontendDir));

// uploaded files
const uploadDir = path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || './uploads');
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use("/api", metaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/rubrics', rubricRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/grading', gradingRoutes);

// SPA-ish fallback for direct navigation to html pages
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'account', 'login.html'));
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`AIGS backend running on http://localhost:${port}`);
});
