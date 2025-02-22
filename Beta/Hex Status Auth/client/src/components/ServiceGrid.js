import React, { useState, useEffect } from 'react';
import { Grid } from '@mui/material';
import ServiceCard from './ServiceCard';

function ServiceGrid() {
  const [services, setServices] = useState([]);

  useEffect(() => {
    const getServices = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/services');
        const data = await response.json();
        setServices(data || []);
      } catch (error) {
        console.error('Error:', error);
        setServices([]);
      }
    };

    getServices();
    const interval = setInterval(getServices, 30000);
    return () => clearInterval(interval);
  }, []);

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
