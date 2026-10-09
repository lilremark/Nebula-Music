import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import { StudioCatalog } from './StudioCatalog';

createRoot(document.getElementById('root')!).render(<React.StrictMode><StudioCatalog /></React.StrictMode>);
