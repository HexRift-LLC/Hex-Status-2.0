import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import config from '../utils/configLoader';

function TermsOfService() {
  console.log('Full config:', config); // Debug log
  
  // Static content for development
  const termsContent = {
    title: 'Terms of Service',
    lastUpdated: '2023-12-01',
    sections: [
      {
        heading: 'Agreement to Terms',
        content: 'By accessing our service, you agree to be bound by these terms...'
      },
      {
        heading: 'Use License',
        content: 'Permission is granted to temporarily download one copy of the materials...'
      }
    ]
  };

  // Use static content while we debug the config loading
  const { title, lastUpdated, sections } = termsContent;

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

export default TermsOfService;