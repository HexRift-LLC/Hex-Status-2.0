/**
 * Hex Status 2.0 - Dashboard JavaScript
 * Optimized client-side functionality for real-time monitoring
 */

// Initialize socket connection with error handling
const socket = io({
    reconnectionAttempts: 5,
    timeout: 10000
  });
  
  // Chart storage and configuration
  const charts = new Map();
  let connectionStatus = {
    connected: false,
    lastUpdate: null
  };
  
  // Theme management
  const themeToggle = document.querySelector('.theme-toggle');
  let darkMode = true; // Default theme is dark
  
  /**
   * Initialize all charts on the dashboard
   */
  function initializeCharts() {
    document.querySelectorAll(".chart-container canvas").forEach((chartCanvas) => {
      if (!chartCanvas.id || !chartCanvas.id.includes("-chart")) {
        console.warn("Chart canvas missing proper ID");
        return;
      }
      
      const serviceName = chartCanvas.id.replace("-chart", "");
      const ctx = chartCanvas.getContext("2d");
      
      // Set default chart config with improved styling
      charts.set(
        serviceName,
        new Chart(ctx, {
          type: "line",
          data: {
            labels: Array(20).fill(""),
            datasets: [{
              label: "Response Time (ms)",
              data: [],
              borderColor: darkMode ? "#6366f1" : "#4f46e5",
              backgroundColor: darkMode ? 
                "rgba(99, 102, 241, 0.1)" : 
                "rgba(79, 70, 229, 0.1)",
              tension: 0.4,
              fill: true,
              borderWidth: 2,
              pointRadius: 1,
              pointHoverRadius: 5
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: darkMode ? "#12141a" : "#f1f5f9",
                titleColor: darkMode ? "#f8fafc" : "#0f172a",
                bodyColor: darkMode ? "#94a3b8" : "#334155",
                borderColor: darkMode ? "#1a1d24" : "#e2e8f0",
                borderWidth: 1,
                padding: 8,
                cornerRadius: 4,
                displayColors: false,
                callbacks: {
                  label: function(context) {
                    return `${context.parsed.y} ms`;
                  }
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: { 
                  color: darkMode ? 
                    "rgba(255, 255, 255, 0.1)" : 
                    "rgba(0, 0, 0, 0.1)" 
                },
                ticks: {
                  color: darkMode ? "#94a3b8" : "#64748b",
                  font: { 
                    size: 10,
                    family: "'Inter', sans-serif"
                  }
                }
              },
              x: {
                grid: { 
                  display: false
                },
                ticks: {
                  color: darkMode ? "#94a3b8" : "#64748b",
                  font: { 
                    size: 10,
                    family: "'Inter', sans-serif"
                  },
                  maxRotation: 0,
                  maxTicksLimit: 5
                }
              }
            },
            animation: {
              duration: 300,
              easing: 'easeOutQuad'
            },
            elements: {
              line: {
                capBezierPoints: true
              }
            }
          }
        })
      );
    });
  }
  
  /**
   * Safely update DOM element text content
   * @param {string} id - Element ID
   * @param {string} value - New value
   * @param {boolean} html - Whether to use innerHTML instead of textContent
   */
  function updateElement(id, value, html = false) {
    if (!id) return;
    const element = document.getElementById(id);
    if (element) {
      if (html) {
        element.innerHTML = value;
      } else {
        element.textContent = value;
      }
    }
  }
  
  /**
   * Update a service card with new data
   * @param {string} service - Service name
   * @param {object} data - Service data
   */
  function updateServiceCard(service, data) {
    if (!service || !data) {
      console.warn("Missing service or data", { service, data });
      return;
    }
    
    // Create safe ID from service name
    const safeName = service.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    
    if (!safeName) {
      console.warn("Could not generate safe name for", service);
      return;
    }
    
    // Update uptime with proper formatting
    const uptimeValue = parseFloat(data.uptime || 0);
    updateElement(`${safeName}-uptime`, `${uptimeValue.toFixed(2)}%`);
    
    // Update health score
    const healthValue = parseFloat(data.healthScore || 0);
    updateElement(`${safeName}-health`, `${healthValue.toFixed(1)}%`);
    
    // Update health progress bar
    const healthBar = document.querySelector(`#${safeName}-card .metric:nth-child(2) .progress-bar-fill`);
    if (healthBar) {
      healthBar.style.width = `${healthValue}%`;
      healthBar.className = "progress-bar-fill";
      if (healthValue > 90) healthBar.classList.add("good");
      else if (healthValue > 70) healthBar.classList.add("warning");
      else healthBar.classList.add("danger");
    }
    
    // Update uptime progress bar
    const uptimeBar = document.querySelector(`#${safeName}-card .metric:nth-child(3) .progress-bar-fill`);
    if (uptimeBar) {
      uptimeBar.style.width = `${uptimeValue}%`;
      uptimeBar.className = "progress-bar-fill";
      if (uptimeValue > 95) uptimeBar.classList.add("success");
      else if (uptimeValue > 90) uptimeBar.classList.add("warning");
      else uptimeBar.classList.add("danger");
    }
    
    // Handle ping data - check if it's an array or single value
    let pingValue, formattedResponse;
    
    if (Array.isArray(data.ping) && data.ping.length > 0) {
      pingValue = data.ping[data.ping.length - 1];
    } else {
      pingValue = data.ping || 0;
    }
    
    if (pingValue >= 9999 || pingValue === 'N/A') {
      formattedResponse = 'Timeout';
    } else {
      formattedResponse = `${Math.round(pingValue)} ms`;
    }
    
    // Update ping with appropriate coloring
    const pingElement = document.getElementById(`${safeName}-ping`);
    if (pingElement) {
      pingElement.textContent = formattedResponse;
      pingElement.className = "metric-value";
      
      if (pingValue < 200) pingElement.classList.add("good");
      else if (pingValue < 500) pingElement.classList.add("warning");
      else pingElement.classList.add("danger");
    }
    
    // Update last check timestamp
    if (data.lastCheck) {
      updateElement(`${safeName}-lastcheck`, moment(data.lastCheck).format("HH:mm:ss"));
    }
    
    // Update service card status class
    const card = document.getElementById(`${safeName}-card`);
    if (card) {
      card.classList.remove("online", "offline");
      card.classList.add(data.status === "up" ? "online" : "offline");
      
      // Update status indicators
      const onlineDot = card.querySelector('.status-dot.online');
      const offlineDot = card.querySelector('.status-dot.offline');
      
      if (onlineDot) onlineDot.classList.toggle('active', data.status === 'up');
      if (offlineDot) offlineDot.classList.toggle('active', data.status === 'down');
    }
    
    // Update chart if it exists
    const chart = charts.get(safeName);
    if (chart && Array.isArray(data.ping)) {
      // Filter out "Timeout" values (9999) and replace with null for gaps
      chart.data.datasets[0].data = data.ping.map(p => p >= 9999 ? null : p);
      
      // Create timestamps for x-axis
      const now = new Date();
      chart.data.labels = data.ping.map((_, i) => {
        const time = new Date(now - (data.ping.length - i - 1) * 5000);
        return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      });
      
      chart.update();
    }
  }
  
  /**
   * Update global statistics display
   * @param {object} stats - Statistics object
   */
  function updateStatistics(stats) {
    if (!stats) return;
    
    // Update basic statistics
    updateElement("total-services", stats.totalServices || 0);
    updateElement("services-up", stats.servicesUp || 0);
    updateElement("services-down", stats.servicesDown || 0);
    
    // Format average ping with appropriate units
    const avgPing = parseFloat(stats.averagePing || 0);
    const formattedAvgPing = avgPing >= 1000 
      ? `${(avgPing/1000).toFixed(1)}s`
      : `${Math.round(avgPing)} ms`;
    
    // Update average ping with color coding
    const pingElement = document.getElementById("average-ping");
    if (pingElement) {
      pingElement.textContent = formattedAvgPing;
      pingElement.className = "value";
      
      if (avgPing < 200) pingElement.classList.add("good");
      else if (avgPing < 500) pingElement.classList.add("warning");
      else pingElement.classList.add("danger");
    }
    
    // Update overall health if present
    if (stats.overallHealth !== undefined) {
      updateElement("overall-health", `${Math.round(stats.overallHealth)}%`);
    }
    
    // Update timestamp
    updateElement("update-time", moment().format("HH:mm:ss"));
    connectionStatus.lastUpdate = Date.now();
  }
  
  /**
   * Display a toast notification
   * @param {string} type - Notification type (success, warning, error, info)
   * @param {string} message - Notification message
   * @param {number} duration - Duration in ms
   */
  function showToast(type, message, duration = 3000) {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Add icon based on type
    let icon;
    switch (type) {
      case 'success': icon = 'fa-check-circle'; break;
      case 'error': icon = 'fa-exclamation-circle'; break;
      case 'warning': icon = 'fa-exclamation-triangle'; break;
      default: icon = 'fa-info-circle';
    }
    
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Animation sequence
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode === toastContainer) {
          toastContainer.removeChild(toast);
        }
      }, 300);
    }, duration);
  }
  
  /**
   * Toggle between dark and light themes
   */
  function toggleTheme() {
    const body = document.body;
    const themeIcon = document.querySelector('.theme-toggle i');
    
    darkMode = !darkMode;
    
    if (darkMode) {
      body.classList.remove('light-theme');
      themeIcon.classList.remove('fa-sun');
      themeIcon.classList.add('fa-moon');
      localStorage.setItem('theme', 'dark');
    } else {
      body.classList.add('light-theme');
      themeIcon.classList.remove('fa-moon');
      themeIcon.classList.add('fa-sun');
      localStorage.setItem('theme', 'light');
    }
    
    // Reinitialize charts with new theme colors
    charts.forEach(chart => chart.destroy());
    charts.clear();
    initializeCharts();
  }
  
  /**
   * Request a manual data refresh from the server
   */
  function requestRefresh() {
    if (connectionStatus.connected) {
      socket.emit('requestRefresh');
      showToast('info', 'Refreshing data...', 2000);
    } else {
      showToast('error', 'Disconnected from server. Trying to reconnect...', 3000);
      socket.connect();
    }
  }
  
  // Initialize on DOM content loaded
  document.addEventListener("DOMContentLoaded", () => {
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      darkMode = false;
      document.body.classList.add('light-theme');
      const themeIcon = document.querySelector('.theme-toggle i');
      if (themeIcon) {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
      }
    }
    
    // Initialize chart instances
    initializeCharts();
    
    // Set up theme toggle
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Set up manual refresh button if it exists
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        requestRefresh();
        refreshButton.classList.add('rotating');
        setTimeout(() => refreshButton.classList.remove('rotating'), 1000);
      });
    }
    
    // Update timestamp initially
    updateElement("update-time", moment().format("HH:mm:ss"));
  });
  // Socket events
socket.on('connect', () => {
    connectionStatus.connected = true;
    showToast('success', 'Connected to server', 2000);
    
    // Update connection status indicator if it exists
    const statusIndicator = document.querySelector('.connection-status');
    if (statusIndicator) {
      statusIndicator.classList.remove('disconnected');
      statusIndicator.classList.add('connected');
      statusIndicator.setAttribute('data-tooltip', 'Connected to server');
    }
  });
  
  socket.on('disconnect', () => {
    connectionStatus.connected = false;
    showToast('error', 'Disconnected from server', 3000);
    
    // Update connection status indicator if it exists
    const statusIndicator = document.querySelector('.connection-status');
    if (statusIndicator) {
      statusIndicator.classList.remove('connected');
      statusIndicator.classList.add('disconnected');
      statusIndicator.setAttribute('data-tooltip', 'Disconnected from server');
    }
    
    // Attempt to reconnect after a delay
    setTimeout(() => {
      if (!connectionStatus.connected) {
        socket.connect();
      }
    }, 5000);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    connectionStatus.connected = false;
    showToast('error', 'Connection error: ' + error.message, 3000);
  });
  
  socket.on('initialData', (data) => {
    
    // Initialize service data
    if (data.services && data.serviceData) {
      try {
        const services = data.services;
        const serviceData = data.serviceData;
        
        services.forEach(service => {
          const data = serviceData[service.name];
          if (data) {
            updateServiceCard(service.name, data);
          }
        });
      } catch (error) {
        console.error('Error processing initial service data:', error);
      }
    }
    
    // Update global stats
    if (data.stats) {
      updateStatistics(data.stats);
    }
    
    showToast('info', 'Data loaded successfully', 2000);
  });
  
  socket.on('statusUpdate', ({ service, data, stats }) => {
    try {
      if (!service || !data) {
        console.warn('Received invalid status update', { service, data });
        return;
      }
      
      // Update the service card
      updateServiceCard(service, data);
      
      // Update global stats if provided
      if (stats) {
        updateStatistics(stats);
      }
    } catch (error) {
      console.error('Error handling status update:', error);
    }
  });
  
  socket.on('statsUpdate', (stats) => {
    try {
      updateStatistics(stats);
    } catch (error) {
      console.error('Error updating statistics:', error);
    }
  });
  
  socket.on('configUpdate', (data) => {
    showToast('info', 'Configuration updated. Refreshing...', 2000);
    
    // Reload the page after a short delay to apply new configuration
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  });
  
  socket.on('serviceAdded', (service) => {
    showToast('success', `New service added: ${service.name}`, 3000);
    
    // Reload the page to show the new service
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  });
  
  socket.on('serviceRemoved', (serviceName) => {
    showToast('warning', `Service removed: ${serviceName}`, 3000);
    
    // Reload the page to update the services list
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  });
  
  socket.on('incident', (data) => {    
    const { service, status, message } = data;
    let toastType, toastMessage;
    
    if (status === 'down') {
      toastType = 'error';
      toastMessage = `Service down: ${service} - ${message}`;
    } else if (status === 'up') {
      toastType = 'success';
      toastMessage = `Service recovered: ${service} - ${message}`;
    } else {
      toastType = 'warning';
      toastMessage = `Service issue: ${service} - ${message}`;
    }
    
    showToast(toastType, toastMessage, 5000);
  });
  
  // Setup connection status checking
  setInterval(() => {
    if (connectionStatus.connected) {
      // Check if we've received updates recently
      const now = Date.now();
      const lastUpdateDiff = now - (connectionStatus.lastUpdate || 0);
      
      if (lastUpdateDiff > 30000) { // 30 seconds
        console.warn('No updates received for 30 seconds');
        showToast('warning', 'No recent updates from server', 3000);
      }
    }
  }, 30000);
  
  // Function to format average response time
  function formatAverageResponse(value) {
    const avgValue = Number(value);
    if (isNaN(avgValue)) return '0 ms';
    
    if (avgValue >= 1000) {
      return `${(avgValue/1000).toFixed(1)}s`;
    }
    return `${Math.round(avgValue)} ms`;
  }
  
  // Add shortcut for manual refresh (Ctrl+R or Cmd+R)
  document.addEventListener('keydown', (event) => {
    // Check if Ctrl/Cmd + R is pressed
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
      // Prevent the default browser refresh
      event.preventDefault();
      
      // Perform our custom refresh
      requestRefresh();
    }
  });
  
  