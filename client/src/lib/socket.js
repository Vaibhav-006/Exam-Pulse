import { io } from 'socket.io-client';

export const getSocketUrl = () => {
  let url = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '';
  if (url) {
    url = url.trim().replace(/\/$/, '');
    if (url.endsWith('/api')) {
      url = url.slice(0, -4);
    }
    return url;
  }
  return '/';
};

export const createSocket = (options = {}) => {
  const url = getSocketUrl();
  return io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    ...options,
  });
};
