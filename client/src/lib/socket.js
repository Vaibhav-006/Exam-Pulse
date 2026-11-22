import { io } from 'socket.io-client';

export const getSocketUrl = () => {
  return import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || '/';
};

export const createSocket = (options = {}) => {
  return io(getSocketUrl(), options);
};
