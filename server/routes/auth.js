import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'exampulse_super_secret_jwt_fallback_key_2026';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });

  try {
    const existing = await prisma.teacher.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    const teacher = await prisma.teacher.create({
      data: { name, email, passwordHash },
      select: { id: true, name: true, email: true },
    });

    const token = jwt.sign({ id: teacher.id, role: 'teacher' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, teacher });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const teacher = await prisma.teacher.findUnique({ where: { email } });
    if (!teacher) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, teacher.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: teacher.id, role: 'teacher' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, teacher: { id: teacher.id, name: teacher.name, email: teacher.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
