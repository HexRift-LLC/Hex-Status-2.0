import React from 'react';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { createAppTheme } from './theme';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Contact from './pages/Contact';

function AppContent() {
  const { settings } = useSettings();
  const theme = createAppTheme(settings.darkMode);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh'
      }}>
        <Navbar />
        <Box component="main" sx={{ 
          flexGrow: 1, 
          p: 3,
          maxWidth: 1440,
          mx: 'auto',
          width: '100%'
        }}>
          <Routes>
            <Route exact path="/" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </Box>
        <Footer />
      </Box>
    </ThemeProvider>
  );
}

function App() {
  return (
    <SettingsProvider>
      <Router>
        <AppContent />
      </Router>
    </SettingsProvider>
  );
}

export default App;