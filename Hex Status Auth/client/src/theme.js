import { createTheme } from '@mui/material';

export const createAppTheme = (darkMode) => createTheme({
  palette: {
    mode: darkMode ? 'dark' : 'light',
    primary: {
      main: darkMode ? '#00ff00' : '#00cc00',
    },
    background: {
      default: darkMode ? '#121212' : '#f8f9fa',
      paper: darkMode ? '#1E1E1E' : '#ffffff',
    },
    text: {
      primary: darkMode ? '#ffffff' : '#2d3436',
      secondary: darkMode ? '#b2bec3' : '#636e72',
    }
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 12,
          border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          backgroundColor: darkMode ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: darkMode 
            ? 'linear-gradient(145deg, #121212 0%, #1a1a1a 100%)'
            : 'linear-gradient(145deg, #f8f9fa 0%, #e9ecef 100%)',
        },
      },
    },
  },
});