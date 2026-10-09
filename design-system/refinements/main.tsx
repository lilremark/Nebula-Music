import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import './refinements.css';
import { RefinementLab } from './RefinementLab';

createRoot(document.getElementById('root')!).render(<React.StrictMode><RefinementLab /></React.StrictMode>);
