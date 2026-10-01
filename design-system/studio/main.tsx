import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import './remix.css';
import { StudioApp } from './StudioApp';

document.body.classList.add('studio-preview');
createRoot(document.getElementById('root')!).render(<React.StrictMode><StudioApp /></React.StrictMode>);
