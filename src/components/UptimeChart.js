import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const UptimeChart = ({ services, statusData }) => {
  const uptimeData = services.map(service => {
    return (statusData[service.id]?.uptime || 0).toFixed(2);
  });
  
  const serviceNames = services.map(service => service.name);
  
  // Get gradient backgrounds for bars
  const getGradientBackground = (ctx, value) => {
    if (!ctx) return 'rgba(16, 185, 129, 0.7)';  // Default color if context not available
    
    const numValue = parseFloat(value);
    let gradient;
    
    if (numValue >= 99) {
      // Green gradient for excellent
      gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.3)');
    } else if (numValue >= 95) {
      // Amber gradient for good
      gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(245, 158, 11, 0.8)');
      gradient.addColorStop(1, 'rgba(245, 158, 11, 0.3)');
    } else {
      // Red gradient for poor
      gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');
    }
    
    return gradient;
  };
  
  const chartData = {
    labels: serviceNames,
    datasets: [
      {
        label: 'Uptime %',
        data: uptimeData,
        backgroundColor: function(context) {
          const index = context.dataIndex;
          const value = context.dataset.data[index];
          const ctx = context.chart.ctx;
          return getGradientBackground(ctx, value);
        },
        borderRadius: 8,
        maxBarThickness: 40,
        borderSkipped: false,
      }
    ]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        border: {
          display: false
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          padding: 10,
          font: {
            size: 11
          },
          callback: function(value) {
            return value + '%';
          }
        }
      },
      x: {
        border: {
          display: false
        },
        grid: {
          display: false
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          padding: 10,
          font: {
            size: 11
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        bodyFont: {
          size: 13
        },
        titleFont: {
          size: 13,
          weight: 'bold'
        },
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: function(context) {
            const value = parseFloat(context.raw);
            let statusText = value >= 99 ? 'Excellent' : value >= 95 ? 'Good' : 'Needs Attention';
            return [`Uptime: ${context.raw}%`, `Status: ${statusText}`];
          }
        }
      }
    }
  };
  
  return (
    <div style={{ height: '350px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default UptimeChart;