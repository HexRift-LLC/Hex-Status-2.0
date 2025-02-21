const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const config = yaml.load(fs.readFileSync(path.join(__dirname, '../../config/config.yml'), 'utf8'));

const width = 1200;  // Increased width for better detail
const height = 600;  // Increased height for better visibility

const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
    width, 
    height,
    backgroundColour: 'rgb(18, 18, 18)' // Dark theme background
});

async function generateStatsGraph(services, settings, type) {
    const timeLabels = generateTimeLabels();
    const datasets = config.services.map(service => ({
        label: service.name,
        data: generateDataPoints(timeLabels.length),
        borderColor: getRandomColor(),
        backgroundColor: (context) => {
            const gradient = context.chart.ctx.createLinearGradient(0, 0, 0, height);
            const color = getRandomColor();
            gradient.addColorStop(0, `${color}33`);  // 20% opacity
            gradient.addColorStop(1, `${color}00`);  // 0% opacity
            return gradient;
        },
        fill: true,
        tension: 0.4,
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6
    }));

    const configuration = {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets
        },
        options: {
            responsive: true,
            animation: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#ffffff',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: 20
                    }
                },
                title: {
                    display: true,
                    text: 'Service Response Times (24h)',
                    color: '#ffffff',
                    font: {
                        size: 18,
                        weight: 'bold'
                    },
                    padding: 20
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        padding: 10
                    },
                    title: {
                        display: true,
                        text: 'Response Time (ms)',
                        color: '#ffffff',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        padding: 10
                    }
                }
            }
        }
    };

    return await chartJSNodeCanvas.renderToBuffer(configuration);
}

function generateTimeLabels() {
    const labels = [];
    for (let i = 24; i >= 0; i--) {
        const date = new Date();
        date.setHours(date.getHours() - i);
        labels.push(date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }
    return labels;
}

function generateDataPoints(length) {
    return Array.from({ length }, () => Math.floor(Math.random() * (300 - 50) + 50));
}

function getRandomColor() {
    const colors = ['#00ff00', '#00ccff', '#ff3399', '#ffcc00', '#9933ff'];
    return colors[Math.floor(Math.random() * colors.length)];
}

module.exports = {
    generateStatsGraph
};