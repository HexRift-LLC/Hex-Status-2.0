const socket = io();
const charts = new Map();

// Function to initialize charts
function initializeCharts() {
  document
    .querySelectorAll(".chart-container canvas")
    .forEach((chartCanvas) => {
      let serviceName = chartCanvas.id.replace("-chart", ""); // Extract service name from ID
      let chartContext = chartCanvas.getContext("2d");

      charts.set(
        serviceName,
        new Chart(chartContext, {
          type: "line",
          data: {
            labels: [],
            datasets: [
              {
                label: "Response Time (ms)",
                data: [],
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                tension: 0.4,
                fill: true,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: "rgba(255, 255, 255, 0.1)" },
                ticks: { color: "#94a3b8" },
              },
              x: {
                grid: { display: false },
                ticks: { color: "#94a3b8" },
              },
            },
          },
        })
      );
    });
}

// Initialize charts when DOM is fully loaded
document.addEventListener("DOMContentLoaded", initializeCharts);

// Function to safely update DOM elements
function updateElement(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}
    socket.on("statusUpdate", ({ service, data, stats }) => {
        const safeName = service.replace(/\s+/g, "_");

        if (!data) return;

        // Convert uptime to number and handle formatting
        const uptimeValue = Number(data.uptime || 0);
        updateElement(
            `${safeName}-uptime`, 
            `${uptimeValue.toFixed(2)}%`
        );

        // Handle response time formatting
        const lastPing = Array.isArray(data.ping) && data.ping.length > 0 
            ? Number(data.ping[data.ping.length - 1]) 
            : 0;
    
        const formattedResponse = lastPing >= 9999 
            ? 'Timeout' 
            : `${Math.round(lastPing)} ms`;

        // Update UI elements
        updateElement(`${safeName}-status`, (data.status || 'unknown').toUpperCase());
        updateElement(`${safeName}-ping`, formattedResponse);
        updateElement(`${safeName}-health`, `${Number(data.healthScore || 0).toFixed(2)}%`);
        updateElement(`${safeName}-lastcheck`, moment(data.lastCheck).format("HH:mm:ss"));

        // Update status indicators
        const statusBadge = document.querySelector(`#${safeName}-card .status-badge`);
        if (statusBadge) {
          statusBadge.className = `status-badge ${data.status}`;
        }

        // Update chart if it exists
        const chart = charts.get(safeName);
        if (chart) {
            if (data.status === 'down') {
                chart.data.datasets[0].data.push(null); // Show gap in line for downtime
            } else {
                chart.data.datasets[0].data = data.ping;
            }
            chart.data.labels = Array(chart.data.datasets[0].data.length).fill("");
            chart.update();
        }

        // Update global stats
        updateElement("total-services", stats.totalServices);
        updateElement("services-up", stats.servicesUp);
        updateElement("services-down", stats.servicesDown);
        updateElement("average-ping", formatAverageResponse(stats.averagePing));
        updateElement("overall-health", `${stats.overallHealth}%`);
        updateElement(
          `${safeName}-lastcheck`,
          moment(data.lastCheck).format("HH:mm:ss")
        );
      

        // Update the last updated timestamp
        updateElement("update-time", moment().format("MMMM D, YYYY HH:mm:ss"));
    });

function formatAverageResponse(value) {
      const avgValue = Number(value);
      if (avgValue >= 1000) {
          return `${(avgValue/1000).toFixed(1)}s`;
      }
      return `${Math.round(avgValue)} ms`;
} 
