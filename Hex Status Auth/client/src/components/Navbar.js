import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box,
  Container 
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';

function Navbar() {
  const location = useLocation();
    return (
      <AppBar 
        position="sticky" 
        elevation={0} 
        sx={{ 
          backdropFilter: 'blur(8px)',
          backgroundColor: theme => theme.palette.mode === 'dark'
            ? 'rgba(26, 26, 26, 0.8)'
            : 'rgba(255, 255, 255, 0.8)',
          borderBottom: theme => `1px solid ${
            theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(0, 0, 0, 0.1)'
          }`
        }}
      >
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <Typography variant="h6" component="div" sx={{ 
            flexGrow: 1,
            fontWeight: 700,
            background: 'linear-gradient(45deg, #00ff00, #00cc00)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Hex Status 2.0
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button 
              color="inherit" 
              component={Link} 
              to="/" 
              startIcon={<DashboardIcon />}
              sx={{ 
                borderRadius: 2,
                ...(location.pathname === '/' && {
                  background: 'rgba(0, 255, 0, 0.1)'
                })
              }}
            >
              Dashboard
            </Button>
            <Button 
              color="inherit" 
              component={Link} 
              to="/settings" 
              startIcon={<SettingsIcon />}
              sx={{ 
                borderRadius: 2,
                ...(location.pathname === '/settings' && {
                  background: 'rgba(0, 255, 0, 0.1)'
                })
              }}
            >
              Settings
            </Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default Navbar;