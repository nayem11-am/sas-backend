import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.routes';
import taskRoutes from './routes/task.routes';
import workspaceRoutes from './routes/workspace.routes';
import goalRoutes from './routes/goal.routes';
import announcementRoutes from './routes/announcement.routes';
import analyticsRoutes from './routes/analytics.routes';
import notificationRoutes from './routes/notification.routes';
import userRoutes from './routes/user.routes';


dotenv.config();

const app = express();
const httpServer = createServer(app);

// --- Middleware ---
const allowedOrigins = [
  'http://localhost:3000',
  'https://myfirstfullstack.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);


app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

// --- Socket.io ---
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Inject io into req
app.use((req, res, next) => {
  (req as any).io = io;
  next();
});

const workspaceOnlineUsers = new Map<string, Map<string, { id: string; name: string; socketId: string }>>();

io.on('connection', (socket) => {
  const { workspaceId, userId, userName } = socket.handshake.query as { 
    workspaceId: string; 
    userId: string; 
    userName: string 
  };

  if (!workspaceId || !userId) {
    console.log('⚠️ Socket connection rejected: Missing workspaceId or userId');
    socket.disconnect();
    return;
  }

  // 1. Join Workspace Room
  socket.join(workspaceId);
  console.log(`🔌 User ${userName || userId} connected to workspace: ${workspaceId}`);

  // 2. Track Online Users for this Workspace
  if (!workspaceOnlineUsers.has(workspaceId)) {
    workspaceOnlineUsers.set(workspaceId, new Map());
  }
  workspaceOnlineUsers.get(workspaceId)?.set(userId, { 
    id: userId, 
    name: userName || 'Anonymous', 
    socketId: socket.id 
  });

  // 3. Broadcast Presence to the Workspace Room
  const onlineUsers = Array.from(workspaceOnlineUsers.get(workspaceId)!.values());
  io.to(workspaceId).emit('workspace:presence', onlineUsers);

  // 4. Real-time Events with Scoped Broadcasting
  socket.on('content:update', (data) => {
    // Broadcast to others in the same workspace
    socket.to(workspaceId).emit('content:updated', data);
  });

  socket.on('disconnect', () => {
    const users = workspaceOnlineUsers.get(workspaceId);
    if (users) {
      users.delete(userId);
      if (users.size === 0) {
        workspaceOnlineUsers.delete(workspaceId);
      } else {
        io.to(workspaceId).emit('workspace:presence', Array.from(users.values()));
      }
    }
    console.log(`❌ User ${userId} left workspace: ${workspaceId}`);
  });
});


const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});