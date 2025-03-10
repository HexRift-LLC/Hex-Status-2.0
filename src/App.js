import React, { useState, useEffect } from 'react';
import StatusOverview from './components/StatusOverview';
import ServiceGrid from './components/ServiceGrid';
import ResponseTimeChart from './components/ResponseTimeChart';
import UptimeChart from './components/UptimeChart';
import LoadingSpinner from './components/LoadingSpinner';
import { Helmet } from 'react-helmet';
import './styles.css';

function App() {
  const [config, setConfig] = useState(null);
  const [services, setServices] = useState([]);
  const [statusData, setStatusData] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [globalStatus, setGlobalStatus] = useState('up');

  const generateStatusData = (serviceId) => {
    const isUp = serviceId === "auth-service" ? false : Math.random() < 0.85;

    const uptime = isUp
      ? (99 + Math.random()).toFixed(2)
      : (Math.random() * 97).toFixed(2);

    const responseTime = [];
    for (let i = 0; i < 24; i++) {
      const time = new Date();
      time.setHours(time.getHours() - (24 - i));

      responseTime.push({
        time: time.toISOString(),
        value: isUp
          ? Math.floor(150 + Math.random() * 150)
          : i < 20
          ? Math.floor(250 + Math.random() * 150)
          : null,
      });
    }

    const history = [];
    for (let i = 0; i < 24; i++) {
      const time = new Date();
      time.setHours(time.getHours() - (24 - i));

      const status = i >= 20 && !isUp ? "down" : "up";

      history.push({
        time: time.toISOString(),
        status,
      });
    }

    return {
      current: isUp ? "up" : "down",
      uptime: parseFloat(uptime),
      responseTime,
      history,
    };
  };

  useEffect(() => {
    fetch('/api/config')
      .then(response => {
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        return response.json();
      })
      .then(configData => {
        setConfig(configData);
        
        const configServices = configData.services || [];
        
        const statusDataObj = {};
        configServices.forEach(service => {
          statusDataObj[service.id] = generateStatusData(service.id);
        });
        
        setServices(configServices);
        setStatusData(statusDataObj);
        
        const statuses = Object.values(statusDataObj).map(s => s.current);
        if (statuses.includes('down')) {
          setGlobalStatus('down');
        } else if (statuses.includes('unknown')) {
          setGlobalStatus('issue');
        } else {
          setGlobalStatus('up');
        }
        
        setLastUpdated(new Date());
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to load config:', error);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (loading || !config) return;
    
    const refreshInterval = setInterval(() => {
      refreshData();
    }, 20000);
    
    return () => clearInterval(refreshInterval);
  }, [loading, config]);

  const refreshData = () => {
    if (loading) return;
    setLoading(true);
    
    setTimeout(() => {
      const statusDataObj = {};
      services.forEach(service => {
        statusDataObj[service.id] = generateStatusData(service.id);
      });
      
      setStatusData(statusDataObj);
      
      const statuses = Object.values(statusDataObj).map(s => s.current);
      if (statuses.includes('down')) {
        setGlobalStatus('down');
      } else if (statuses.includes('unknown')) {
        setGlobalStatus('issue');
      } else {
        setGlobalStatus('up');
      }
      
      setLastUpdated(new Date());
      setLoading(false);
    }, 1000);
  };

  if (!config || loading) {
    return <LoadingSpinner />;
  }

  const servicesTotal = services.length;
  const servicesUp = Object.values(statusData).filter(
    (s) => s.current === "up"
  ).length;
  const servicesDown = Object.values(statusData).filter(
    (s) => s.current === "down"
  ).length;

  const uptimeValues = Object.values(statusData)
    .filter((s) => typeof s.uptime === "number")
    .map((s) => s.uptime);

  const averageUptime = uptimeValues.length
    ? (uptimeValues.reduce((a, b) => a + b, 0) / uptimeValues.length).toFixed(2)
    : "0.00";

  const responseTimes = [];
  Object.values(statusData).forEach((service) => {
    if (service?.responseTime && service.responseTime.length > 0) {
      const latestResponse =
        service.responseTime[service.responseTime.length - 1];
      if (latestResponse && typeof latestResponse.value === "number") {
        responseTimes.push(latestResponse.value);
      }
    }
  });

  const avgResponseTime =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        )
      : 0;

  return (
    <div className="dashboard">
      {config && (
        <Helmet>
          <title>{config.siteName || 'Status Dashboard'}</title>
        </Helmet>
      )}
      <header>
        <div className="header-content">
          <div className="logo-area">
            <h1>{config.siteName || 'Status Dashboard'}</h1>
            <div className="subtitle">Real-time system monitoring</div>
          </div>
          <div className="global-status">
            <div className={`global-status-indicator ${globalStatus}`}></div>
            <div className="global-status-text">
              {globalStatus === "up"
                ? "All Systems Operational"
                : globalStatus === "issue"
                ? "Partial System Outage"
                : "Major System Outage"}
            </div>
          </div>
        </div>
      </header>

      <div className="main-content">
        <h2 className="section-title">
          <i className="fas fa-chart-pie"></i>
          Dashboard Overview
        </h2>
        <StatusOverview
          servicesTotal={servicesTotal}
          servicesUp={servicesUp}
          servicesDown={servicesDown}
          averageUptime={averageUptime}
          averageResponseTime={avgResponseTime}
        />

        <div className="chart-container">
          <div className="chart-header">
            <div className="chart-title">
              <i className="fas fa-bolt"></i>
              Response Time Monitoring
            </div>
            <div className="chart-actions">
              <button className="chart-action-button" onClick={refreshData}>
                <i className="fas fa-sync-alt"></i>
              </button>
            </div>
          </div>
          <ResponseTimeChart services={services} statusData={statusData} />
        </div>

        <div className="chart-container">
          <div className="chart-header">
            <div className="chart-title">
              <i className="fas fa-clock"></i>
              Service Uptime
            </div>
            <div className="chart-actions">
              <button className="chart-action-button" onClick={refreshData}>
                <i className="fas fa-sync-alt"></i>
              </button>
            </div>
          </div>
          <UptimeChart services={services} statusData={statusData} />
        </div>

        <h2 className="section-title">
          <i className="fas fa-server"></i>
          Service Status
        </h2>
        <ServiceGrid services={services} statusData={statusData} />

        <div className="timestamp">
          <i className="fas fa-history"></i>
          Last updated: {lastUpdated.toLocaleTimeString()} —{" "}
          {lastUpdated.toLocaleDateString()}
        </div>
      </div>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-copyright">
            © {new Date().getFullYear()} {config.siteName || "Status Dashboard"}
            . All rights reserved.
          </div>
          <div className="footer-links">
            {config.Links &&
              config.Links.slice(0, 3).map((link, index) => (
                <a key={index} href={link.url} className="footer-link">
                  {link.name}
                </a>
              ))}
          </div>
        </div>
      </footer>
    </div>
  );}

export default App;