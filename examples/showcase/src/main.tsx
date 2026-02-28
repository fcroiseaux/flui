import { createRoot } from 'react-dom/client';

import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

// StrictMode is intentionally omitted: it double-invokes effects,
// which drains the MockConnector FIFO queue before the real render.
createRoot(root).render(<App />);
