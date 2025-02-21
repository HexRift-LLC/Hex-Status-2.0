import React, { useState, useEffect } from 'react';
import { Grid } from '@mui/material';
import ServiceCard from './ServiceCard';

function ServiceGrid() {
  const [services, setServices] = useState([]);
  const [baseUrl, setBaseUrl] = useState('');
  useEffect(() => {
    const getConfig = async () => {
      const response = await fetch(`${baseUrl}/api/config`);
      const config = await response.json();
      setBaseUrl(config.baseUrl);
    };
    getConfig();
  }, []);
  
  useEffect(() => {
    const getServices = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/services`);
        const data = await response.json();
        setServices(data || []);
      } catch (error) {
        console.error('Error:', error);
        setServices([]);
      }
    };
  
    getServices();
    const interval = setInterval(getServices, 5000);
    return () => clearInterval(interval);
  }, [baseUrl]);

  return (
    <Grid container spacing={3}>
      {services.map((service) => (
        <Grid item xs={12} md={4} key={service.name}>
          <ServiceCard 
            name={service.name}
            status={service.status ? 'up' : 'down'}
            latency={service.responseTime}
            uptime={service.uptime}
          />
        </Grid>
      ))}
    </Grid>
  );
}

export default ServiceGrid;
