import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [teacher, setTeacher] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('ep_token');
    const storedTeacher = localStorage.getItem('ep_teacher');
    if (storedToken && storedTeacher) {
      setToken(storedToken);
      setTeacher(JSON.parse(storedTeacher));
    }
    setLoading(false);
  }, []);

  const login = (tokenVal, teacherVal) => {
    setToken(tokenVal);
    setTeacher(teacherVal);
    localStorage.setItem('ep_token', tokenVal);
    localStorage.setItem('ep_teacher', JSON.stringify(teacherVal));
  };

  const logout = () => {
    setToken(null);
    setTeacher(null);
    localStorage.removeItem('ep_token');
    localStorage.removeItem('ep_teacher');
  };

  return (
    <AuthContext.Provider value={{ teacher, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
