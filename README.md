# ExamPulse 🎓

An AI-powered proctored MCQ exam platform for teachers and students.

## Features
- 📄 Upload PDF/DOCX/TXT documents → AI generates MCQs automatically
- 🤖 Google Gemini AI picks the best questions from your content
- 🔒 Student lockdown mode (fullscreen, no tab switching)
- 📷 Live camera monitoring for all students
- ⚡ Real-time violation alerts
- 📊 Results & analytics dashboard

## Setup

### Prerequisites
- Node.js v18+
- Google Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))

### 1. Server Setup
```bash
cd server
npm install
npx prisma db push
npm run dev
```

### 2. Add Gemini API Key
Edit `server/.env`:
```
GEMINI_API_KEY=your_actual_key_here
```

### 3. Client Setup
```bash
cd client
npm install
npm run dev
```

### 4. Open
- **Teacher Portal**: http://localhost:5173
- **Student Exam**: http://localhost:5173/join

## Usage

### Teacher Flow
1. Register/Login at `/teacher`
2. Go to "New Test" → Upload a document
3. Set number of MCQs to generate
4. AI processes and shows you the questions
5. Review/edit, then publish the test
6. Share the **6-character join code** with students
7. Click "Monitor" to watch student cameras live

### Student Flow
1. Go to `/join` on any desktop Chrome browser
2. Enter join code + your name
3. Allow camera access
4. Exam starts in fullscreen lockdown mode
5. Complete and submit within the time limit
