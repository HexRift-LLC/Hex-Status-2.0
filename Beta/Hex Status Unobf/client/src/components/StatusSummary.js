import React, { useState, useEffect } from 'react';
import { Paper, Box, Typography, Grid, Divider } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { io } from 'socket.io-client';

const socket = io({
  transports: ["websocket"],
  path: "/socket.io",
  host: "localhost",
  port: 3001
});


function StatusSummary() {
  const [statusData, setStatusData] = useState({
    operationalCount: 0,
    issuesCount: 0,
    averageResponse: 0,
    allOperational: true
  });

  useEffect(() => {
    socket.on('servicesUpdate', (services) => {
      const operational = services.filter(service => service.status).length;
      const issues = services.length - operational;
      const avgResponse = Math.round(
        services.reduce((acc, service) => acc + service.responseTime, 0) / services.length
      );

      setStatusData({
        operationalCount: operational,
        issuesCount: issues,
        averageResponse: avgResponse,
        allOperational: issues === 0
      });
    });

    return () => {
      socket.off('servicesUpdate');
    };
  }, []);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        backgroundColor: theme => theme.palette.mode === 'dark' 
          ? 'rgba(30, 30, 30, 0.6)'
          : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)',
        borderRadius: 3,
        border: theme => `1px solid ${
          theme.palette.mode === 'dark' 
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.1)'
        }`,
        mb: 4
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          System Status Overview
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon sx={{ color: statusData.allOperational ? '#00ff00' : '#ff0000' }} />
          <Typography variant="body2" sx={{ color: statusData.allOperational ? '#00ff00' : '#ff0000' }}>
            {statusData.allOperational ? 'All Systems Operational' : 'System Issues Detected'}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 2, opacity: 0.1 }} />

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            p: 2,
            backgroundColor: 'rgba(255, 0, 0, 0.05)',
            borderRadius: 2
          }}>
            <CheckCircleIcon sx={{ color: '#00ff00', fontSize: 40 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#00ff00' }}>
                {statusData.operationalCount}
              </Typography>
              <Typography variant="body2">Operational Services</Typography>
            </Box>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            p: 2,
            backgroundColor: 'rgba(255, 0, 0, 0.05)',
            borderRadius: 2
          }}>
            <ErrorIcon sx={{ color: '#ff0000', fontSize: 40 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#ff0000' }}>
                {statusData.issuesCount}
              </Typography>
              <Typography variant="body2">Service Issues</Typography>
            </Box>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            p: 2,
            backgroundColor: 'rgba(0, 255, 255, 0.05)',
            borderRadius: 2
          }}>
            <AccessTimeIcon sx={{ color: '#00ffff', fontSize: 40 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600, color: '#00ffff' }}>
                {statusData.averageResponse}
              </Typography>
              <Typography variant="body2">Average Response (ms)</Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}

export default StatusSummary;