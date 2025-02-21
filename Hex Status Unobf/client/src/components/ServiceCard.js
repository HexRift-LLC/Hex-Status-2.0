import React from 'react';
import { Paper, Typography, Box, Chip, Divider } from '@mui/material';
import { Line } from 'react-chartjs-2';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function ServiceCard({ name, status, latency, uptime }) {
  const chartData = {
    labels: ['1h', '2h', '3h', '4h', '5h', '6h'],
    datasets: [{
      label: 'Latency',
      data: [23, 25, 22, 24, 23, 25],
      borderColor: '#00ff00',
      backgroundColor: 'rgba(0, 255, 0, 0.1)',
      fill: true,
      tension: 0.4
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };
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
          transition: 'transform 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)'
          }
        }}
      >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {name}
        </Typography>
        <Chip 
          label={status.toUpperCase()}
          sx={{
            backgroundColor: status === 'up' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
            color: status === 'up' ? '#00ff00' : '#ff0000',
            fontWeight: 600
          }}
        />
      </Box>

      <Divider sx={{ my: 2, opacity: 0.1 }} />

      <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTimeIcon sx={{ color: '#00ff00', fontSize: 20 }} />
          <Typography variant="body2">
            {latency}ms
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon sx={{ color: '#00ff00', fontSize: 20 }} />
          <Typography variant="body2">
            {uptime}% Uptime
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NetworkCheckIcon sx={{ color: '#00ff00', fontSize: 20 }} />
          <Typography variant="body2">
            Healthy
          </Typography>
        </Box>
      </Box>

      <Box sx={{ height: 120 }}>
        <Line data={chartData} options={chartOptions} />
      </Box>
    </Paper>
  );
}

export default ServiceCard;