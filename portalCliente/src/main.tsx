import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './app/context/AuthContext';
import App from './app/App';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento root en el DOM.');

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);