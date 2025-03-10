import React from 'react';
import moment from 'moment';

const ServiceGrid = ({ services, statusData }) => {
  // Helper function to get uptime badge class
  const getUptimeBadgeClass = (uptime) => {
    const numUptime = parseFloat(uptime) || 0;
    if (numUptime >= 99) return 'uptime-excellent';
    if (numUptime >= 95) return 'uptime-good';
    return 'uptime-poor';
  };

  // Helper to safely display URL
  const formatEndpointUrl = (url) => {
    if (!url) return 'Not available';
    try {
      return url.split('/').slice(0, 3).join('/');
    } catch (error) {
      console.error('Error formatting URL:', url, error);
      return String(url) || 'Invalid URL'; 
    }
  };

  return (
    <div className="service-grid">
      {services.map(service => {
        const serviceStatus = statusData[service.id] || {};
        const status = serviceStatus.current || 'unknown';
        const uptime = (serviceStatus.uptime || 0).toFixed(2);
        const responseTimeArr = serviceStatus.responseTime || [];
        const latestResponseTime = responseTimeArr.length > 0 
          ? responseTimeArr[responseTimeArr.length - 1].value 
          : 'N/A';
        
        const historyArr = serviceStatus.history || [];
        const lastChecked = historyArr.length > 0 
          ? moment(historyArr[historyArr.length - 1].time).fromNow() 
          : 'Never';
        
        // Get icon based on service type or name
        const getServiceIcon = () => {
          const serviceType = (service.type || '').toLowerCase();
          const serviceName = (service.name || '').toLowerCase();
          
          if (serviceType.includes('api') || serviceName.includes('api')) return 'fas fa-plug';
          if (serviceType.includes('database') || serviceName.includes('database')) return 'fas fa-database';
          if (serviceType.includes('web') || serviceName.includes('web')) return 'fas fa-globe';
          if (serviceType.includes('auth') || serviceName.includes('auth')) return 'fas fa-lock';
          if (serviceType.includes('storage') || serviceName.includes('storage')) return 'fas fa-hdd';
          if (serviceType.includes('cache') || serviceName.includes('cache')) return 'fas fa-memory';
          if (serviceType.includes('email') || serviceName.includes('email')) return 'fas fa-envelope';
          return 'fas fa-server';
        };
        
        return (
          <div className={`service-card ${status}`} key={service.id}>
            <div className="service-header">
              <div className="service-title">
                <i className={getServiceIcon()}></i>
                {service.name}
              </div>
              <div className={`service-status ${status}`}>
                {status === 'up' ? 'Operational' : status === 'down' ? 'Degraded' : 'Unknown'}
              </div>
            </div>
            <div className="service-description">{service.description || 'No description available'}</div>
            <div className="service-metrics">
              <div className="service-metric">
                <div className="service-metric-label">Uptime</div>
                <div className="service-metric-value">
                  <span className={getUptimeBadgeClass(uptime)}>{uptime}%</span>
                </div>
              </div>
              <div className="service-metric">
                <div className="service-metric-label">Response Time</div>
                <div className="service-metric-value">
                  {typeof latestResponseTime === 'number' ? `${latestResponseTime}ms` : latestResponseTime}
                </div>
              </div>
              <div className="service-metric">
                <div className="service-metric-label">Last Checked</div>
                <div className="service-metric-value">{lastChecked}</div>
              </div>
              <div className="service-metric">
                <div className="service-metric-label">Endpoint</div>
                <div className="service-metric-value" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                  {formatEndpointUrl(service.url)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ServiceGrid;