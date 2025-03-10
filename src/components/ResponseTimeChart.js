import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import moment from 'moment';

// Register ChartJS components including Filler for area charts
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ResponseTimeChart = ({ services, statusData }) => {
  // Prepare data for the chart
  const datasets = services.map((service, index) => {
    const responseTimeData = statusData[service.id]?.responseTime || [];
    
    // Get last 12 data points (or fewer if there's less data)
    const limitedData = responseTimeData.slice(-12);
    
    return {
      label: service.name,
      data: limitedData.map(item => item.value),
      fill: {
        target: 'origin',
        above: getColorWithOpacity(index, 0.1), // Very light fill
      },
      backgroundColor: getColor(index),
      borderColor: getColor(index),
      pointBackgroundColor: getColor(index),
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: getColor(index),
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.4,
      borderWidth: 3
    };
  });
  
  // Get time labels
  const timeLabels = [];
  const firstService = services[0];
  if (firstService && statusData[firstService.id]?.responseTime) {
    const responseTimeData = statusData[firstService.id].responseTime;
    // Get last 12 data points (or fewer if there's less data)
    const limitedData = responseTimeData.slice(-12);
    timeLabels.push(...limitedData.map(item => moment(item.time).format('HH:mm')));
  }
  
  const chartData = {
    labels: timeLabels,
    datasets
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      y: {
        beginAtZero: true,
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
        position: 'top',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            size: 12
          }
        }
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
        displayColors: true,
        usePointStyle: true,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.raw}ms`;
          }
        }
      }
    }
  };
  
  return (
    <div style={{ height: '350px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

// Function to generate colors
function getColor(index) {
  const colors = [
    '#8b5cf6', // Primary color 
    '#10b981', // Green
    '#3b82f6', // Blue
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#6366f1', // Indigo
    '#ef4444'  // Red
  ];
  
  return colors[index % colors.length];
}

// Function to get color with opacity
function getColorWithOpacity(index, opacity) {
  const colors = [
    `rgba(139, 92, 246, ${opacity})`, // Primary color
    `rgba(16, 185, 129, ${opacity})`, // Green
    `rgba(59, 130, 246, ${opacity})`, // Blue
    `rgba(245, 158, 11, ${opacity})`, // Amber
    `rgba(236, 72, 153, ${opacity})`, // Pink
    `rgba(99, 102, 241, ${opacity})`, // Indigo
    `rgba(239, 68, 68, ${opacity})`   // Red
  ];
  
  return colors[index % colors.length];
}

export default ResponseTimeChart;