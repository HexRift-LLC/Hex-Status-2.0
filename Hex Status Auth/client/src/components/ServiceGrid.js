import React, { useState, useEffect } from 'react';
import { Grid } from '@mui/material';
import ServiceCard from './ServiceCard';

function ServiceGrid() {
  const [services, setServices] = useState([]);

  useEffect(() => {
    const getServices = async () => {
      try {
          const response = await fetch('/api/services', {
              headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
              }
          });
  
          if (!response.ok) {
              throw new Error(`Failed to fetch services: ${response.status}`);
          }
  
          const data = await response.json();
          if (!Array.isArray(data)) {
              throw new Error('Invalid data format received');
          }
  
          setServices(data);
      } catch (error) {
          console.error('[ServiceGrid] Data fetch failed:', error.message);
          // Keep previous services data instead of clearing it
          // This provides better UX during temporary API issues
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
