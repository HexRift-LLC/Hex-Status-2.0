import React from 'react';

const StatusOverview = ({ servicesTotal, servicesUp, servicesDown, averageUptime, averageResponseTime }) => {
  // Helper function to get CSS class based on uptime value
  const getUptimeClass = (uptime) => {
    const numUptime = parseFloat(uptime) || 0;
    if (numUptime >= 99) return 'uptime-excellent';
    if (numUptime >= 95) return 'uptime-good';
    return 'uptime-poor';
  };

  // Ensure numerical values for display with proper fallbacks
  const displayTotal = servicesTotal || 0;
  const displayUp = servicesUp || 0;
  const displayDown = servicesDown || 0;
  const displayUptime = averageUptime || '0.00';
  const displayResponseTime = typeof averageResponseTime === 'number' && !isNaN(averageResponseTime) 
    ? `${averageResponseTime}ms` 
    : 'N/A';

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <div className="metric-header">
          <div className="metric-title">Total Services</div>
          <div className="metric-icon">
            <i className="fas fa-server"></i>
          </div>
        </div>
        <div className="metric-value">{displayTotal}</div>
        <div className="metric-label">Monitored systems</div>
      </div>

      <div className="metric-card">
        <div className="metric-header">
          <div className="metric-title">Operational</div>
          <div className="metric-icon">
            <i className="fas fa-check-circle"></i>
          </div>
        </div>
        <div className="metric-value">{displayUp}</div>
        <div className="metric-label">
          {displayUp === displayTotal ? 'All systems operational' : 'Systems functioning properly'}
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-header">
          <div className="metric-title">Degraded</div>
          <div className="metric-icon">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
        </div>
        <div className="metric-value">{displayDown}</div>
        <div className="metric-label">
          {displayDown === 0 ? 'No degraded services' : 'Services experiencing issues'}
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-header">
          <div className="metric-title">Average Uptime</div>
          <div className="metric-icon">
            <i className="fas fa-clock"></i>
          </div>
        </div>
        <div className="metric-value">
          {displayUptime !== '0.00' ? (
            <span className={getUptimeClass(displayUptime)}>{displayUptime}%</span>
          ) : (
            <span className="uptime-poor">0.00%</span>
          )}
        </div>
        <div className="metric-label">Past 24 hours</div>
      </div>

      <div className="metric-card">
        <div className="metric-header">
          <div className="metric-title">Avg Response Time</div>
          <div className="metric-icon">
            <i className="fas fa-bolt"></i>
          </div>
        </div>
        <div className="metric-value">{displayResponseTime}</div>
        <div className="metric-label">Across all services</div>
      </div>
    </div>
  );
};

export default StatusOverview;