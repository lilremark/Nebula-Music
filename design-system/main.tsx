import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './gallery.css';
import { Gallery } from './Gallery';

createRoot(document.getElementById('root')!).render(<React.StrictMode><Gallery /></React.StrictMode>);
