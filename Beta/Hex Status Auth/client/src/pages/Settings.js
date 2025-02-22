import React, { useState } from 'react';
import { 
  Paper, Box, Typography, Switch, FormGroup, FormControlLabel,
  Divider, Button, Grid, Snackbar, TextField 
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DisplaySettingsIcon from '@mui/icons-material/DisplaySettings';
import { useSettings } from '../context/SettingsContext';

function Settings() {
  const { settings, updateSettings } = useSettings();
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [email, setEmail] = useState(settings.userEmail);

  const handleToggle = (setting) => {
    const newSettings = {
      ...settings,
      [setting]: !settings[setting]
    };
    updateSettings(newSettings);
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const handleSave = () => {
    const newSettings = {
      ...settings,
      userEmail: email
    };
    updateSettings(newSettings);
    setShowSaveSuccess(true);
    
    if (settings.pushNotifications) {
      requestNotificationPermission();
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification('Notifications Enabled', {
          body: 'You will now receive push notifications'
        });
      }
    }
  };

  return (
    <Box sx={{ 
      transition: 'all 0.3s ease',
      ...(settings.compactView && {
        '& .MuiPaper-root': {
          p: 2,
        },
        '& .MuiGrid-root': {
          gap: 2
        }
      })
    }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          backgroundColor: settings.darkMode ? 
            'rgba(30, 30, 30, 0.6)' : 
            'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          borderRadius: 3
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <SettingsIcon sx={{ color: '#00ff00', fontSize: 28 }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            System Settings
          </Typography>
        </Box>

        <Divider sx={{ my: 2, opacity: 0.1 }} />

        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <NotificationsIcon sx={{ color: '#00ff00' }} />
                <Typography variant="h6">Notifications</Typography>
              </Box>
              <FormGroup>
                <FormControlLabel 
                  control={
                    <Switch 
                      checked={settings.emailAlerts}
                      onChange={() => handleToggle('emailAlerts')}
                    />
                  } 
                  label="Email Alerts" 
                />
                {settings.emailAlerts && (
                  <TextField
                    fullWidth
                    label="Email Address"
                    variant="outlined"
                    value={email}
                    onChange={handleEmailChange}
                    sx={{ mt: 2, mb: 2 }}
                  />
                )}
                <FormControlLabel 
                  control={
                    <Switch 
                      checked={settings.pushNotifications}
                      onChange={() => handleToggle('pushNotifications')}
                    />
                  } 
                  label="Push Notifications" 
                />
              </FormGroup>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <DisplaySettingsIcon sx={{ color: '#00ff00' }} />
                <Typography variant="h6">Display</Typography>
              </Box>
              <FormGroup>
                <FormControlLabel 
                  control={
                    <Switch 
                      checked={settings.darkMode}
                      onChange={() => handleToggle('darkMode')}
                    />
                  } 
                  label="Dark Mode" 
                />
                <FormControlLabel 
                  control={
                    <Switch 
                      checked={settings.compactView}
                      onChange={() => handleToggle('compactView')}
                    />
                  } 
                  label="Compact View" 
                />
                <FormControlLabel 
                  control={
                    <Switch 
                      checked={settings.realTimeUpdates}
                      onChange={() => handleToggle('realTimeUpdates')}
                    />
                  } 
                  label="Real-time Updates" 
                />
              </FormGroup>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3, opacity: 0.1 }} />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button 
            variant="contained" 
            onClick={handleSave}
            sx={{ 
              background: 'linear-gradient(45deg, #00ff00, #00cc00)',
              '&:hover': {
                background: 'linear-gradient(45deg, #00cc00, #009900)'
              }
            }}
          >
            Save Changes
          </Button>
        </Box>
      </Paper>

      <Snackbar
        open={showSaveSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSaveSuccess(false)}
        message="Settings saved successfully!"
      />
    </Box>
  );
}

export default Settings;