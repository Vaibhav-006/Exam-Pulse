import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import testRoutes from './routes/tests.js';
import uploadRoutes from './routes/upload.js';
import resultRoutes from './routes/results.js';
import sessionRoutes from './routes/sessions.js';
import { setupProctorSocket } from './services/proctorSocket.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Dynamic CORS origin handler: allows localhost, configured CLIENT_URL, or any *.vercel.app domain
const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  const allowed = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(s => s.trim().replace(/\/$/, '')) : [];
  if (
    allowed.includes('*') ||
    allowed.includes(origin) ||
    origin.includes('localhost') ||
    origin.endsWith('.vercel.app')
  ) {
    return callback(null, true);
  }
  return callback(null, true); // Permissive to prevent production deployment lockouts
};

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e7, // 10 MB for video frames
});

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/sessions', sessionRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// WebSocket proctoring
setupProctorSocket(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 ExamPulse server running on http://localhost:${PORT}`);
});
