// WebSocket room management for proctoring
// Rooms are keyed by testId
// Teacher joins as 'teacher-{testId}'
// Students join as 'student-{sessionId}'

export function setupProctorSocket(io) {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Teacher joins monitoring room
    socket.on('teacher:join', ({ testId, teacherToken }) => {
      const room = `test-${testId}`;
      socket.join(room);
      socket.data.role = 'teacher';
      socket.data.testId = testId;
      socket.data.room = room;
      console.log(`Teacher joined room ${room}`);
      
      // Notify teacher of current students in room
      const studentsInRoom = [...io.sockets.sockets.values()]
        .filter(s => s.data.role === 'student' && s.data.testId === testId)
        .map(s => ({ socketId: s.id, sessionId: s.data.sessionId, studentName: s.data.studentName, status: s.data.status }));
      
      socket.emit('room:students', studentsInRoom);
    });

    // Student joins exam room
    socket.on('student:join', ({ testId, sessionId, studentName }) => {
      const room = `test-${testId}`;
      socket.join(room);
      socket.data.role = 'student';
      socket.data.testId = testId;
      socket.data.sessionId = sessionId;
      socket.data.studentName = studentName;
      socket.data.status = 'active';
      socket.data.room = room;
      console.log(`Student ${studentName} (${sessionId}) joined room ${room}`);
      
      // Notify teacher
      socket.to(room).emit('student:joined', {
        socketId: socket.id,
        sessionId,
        studentName,
        status: 'active',
      });
    });

    // Student sends camera frame to teacher (base64 snapshot)
    socket.on('student:frame', ({ frame }) => {
      if (socket.data.role !== 'student') return;
      const room = socket.data.room;
      // Forward ONLY to teachers in room
      socket.to(room).emit('student:frame', {
        socketId: socket.id,
        sessionId: socket.data.sessionId,
        studentName: socket.data.studentName,
        frame,
        timestamp: Date.now(),
      });
    });

    // Student reports a violation
    socket.on('student:violation', ({ violationType }) => {
      if (socket.data.role !== 'student') return;
      const room = socket.data.room;
      console.log(`Violation from ${socket.data.studentName}: ${violationType}`);
      
      // Alert teacher
      socket.to(room).emit('student:violation', {
        socketId: socket.id,
        sessionId: socket.data.sessionId,
        studentName: socket.data.studentName,
        violationType,
        timestamp: Date.now(),
      });
    });

    // Student submits exam
    socket.on('student:submitted', () => {
      if (socket.data.role !== 'student') return;
      socket.data.status = 'submitted';
      socket.to(socket.data.room).emit('student:submitted', {
        socketId: socket.id,
        sessionId: socket.data.sessionId,
        studentName: socket.data.studentName,
      });
    });

    // Teacher sends warning to specific student
    socket.on('teacher:warn', ({ targetSocketId, message }) => {
      if (socket.data.role !== 'teacher') return;
      io.to(targetSocketId).emit('teacher:warning', { message });
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (socket.data.role === 'student' && socket.data.room) {
        socket.to(socket.data.room).emit('student:disconnected', {
          socketId: socket.id,
          sessionId: socket.data.sessionId,
          studentName: socket.data.studentName,
        });
      }
      console.log('Socket disconnected:', socket.id);
    });
  });
}
