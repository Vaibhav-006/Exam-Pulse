// WebSocket room management for proctoring
// Rooms are keyed by testId: 'test-{testId}'
// Teacher joins as 'teacher-{testId}'
// Students join as 'student-{sessionId}'

export function setupProctorSocket(io) {
  io.on('connection', (socket) => {
    // Teacher joins monitoring room
    socket.on('teacher:join', ({ testId, teacherToken }) => {
      const room = `test-${testId}`;
      socket.join(room);
      socket.data.role = 'teacher';
      socket.data.testId = testId;
      socket.data.room = room;
      console.log(`Teacher joined room ${room}`);

      // Notify teacher of current active students in room
      const studentsInRoom = [...io.sockets.sockets.values()]
        .filter(s => s.data.role === 'student' && s.data.testId === testId)
        .map(s => ({
          socketId: s.id,
          sessionId: s.data.sessionId,
          studentName: s.data.studentName,
          status: s.data.status,
          abortReason: s.data.abortReason || null,
        }));

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

    // Teacher ABORTS / TERMINATES a student's test LIVE
    socket.on('teacher:abort_student', ({ targetSocketId, sessionId, studentName, reason }) => {
      if (socket.data.role !== 'teacher') return;
      console.log(`[ALERT] Teacher terminated student ${studentName} (${sessionId}): ${reason}`);

      const abortPayload = {
        socketId: targetSocketId,
        sessionId,
        studentName,
        reason: reason || 'Exam aborted live by proctor for integrity violation.',
        timestamp: Date.now(),
      };

      // 1. Kick student socket immediately
      io.to(targetSocketId).emit('student:aborted', abortPayload);

      // 2. Broadcast to all monitors so card updates to "TERMINATED"
      if (socket.data.room) {
        socket.to(socket.data.room).emit('student:aborted', abortPayload);
      }
      socket.emit('student:aborted', abortPayload);
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
    });
  });
}
