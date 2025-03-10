import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import App from './App';

const applyTheme = (config) => {
  if (config.theme) {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', config.theme.primaryColor || '#8b5cf6');
    root.style.setProperty('--background-color', config.theme.backgroundColor || '#0d0d0d');
    root.style.setProperty('--text-color', config.theme.textColor || '#ffffff');
    root.style.setProperty('--secondary-color', config.theme.secondaryColor || '#6d41d1');
    root.style.setProperty('--accent-color', config.theme.accentColor || '#9d71f7');
  }
};

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
