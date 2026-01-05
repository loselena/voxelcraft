
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThreeElements } from '@react-three/fiber';
import App from './App';

// Add global JSX augmentation for @react-three/fiber intrinsic elements.
// Augmenting React.JSX namespace ensures standard HTML elements are preserved.
declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
