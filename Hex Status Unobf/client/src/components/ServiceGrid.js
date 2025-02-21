import React, { useState, useEffect } from 'react';
import { Grid } from '@mui/material';
import ServiceCard from './ServiceCard';

function ServiceGrid() {
  const [services, setServices] = useState([]);

  useEffect(() => {
    const getServices = async () => {
      try {
        const response = await fetch('/api/services');
  
        console.log("[DEBUG] Response Headers:", response.headers.get("content-type"));
  
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
  
        const text = await response.text();
        console.log("[DEBUG] Raw Response:", text);
  
        const data = JSON.parse(text);
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
