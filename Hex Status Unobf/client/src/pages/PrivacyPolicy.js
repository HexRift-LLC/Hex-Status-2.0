import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import config from '../utils/config';

function PrivacyPolicy() {

  const { title, lastUpdated, sections } = config.legal.privacyPolicy;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        backgroundColor: theme => theme.palette.mode === 'dark' 
          ? 'rgba(30, 30, 30, 0.6)'
          : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)',
        borderRadius: 3
      }}
    >
      <Typography variant="h4" gutterBottom>
        {title}
      </Typography>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Last Updated: {lastUpdated}
      </Typography>
      {sections.map((section, index) => (
        <Box key={index} sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            {section.heading}
          </Typography>
          <Typography variant="body1">
            {section.content}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}

export default PrivacyPolicy;