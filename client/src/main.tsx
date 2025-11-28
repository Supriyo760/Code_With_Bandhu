// client/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { EditorProvider } from './context/EditorContext';
import { Analytics } from '@vercel/analytics/react';

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
    <EditorProvider>
      <App />
      <Analytics />
    </EditorProvider>
  // </React.StrictMode>
);