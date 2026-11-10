import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

import { me } from './store.js';
import { input } from './controls.js';
import { pathAt } from '../shared/path.js';
if (location.search.includes('debug')) window.__dbg = { me, input, pathAt };

createRoot(document.getElementById('root')).render(<App />);
