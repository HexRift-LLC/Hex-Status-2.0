import React, { useState, useEffect } from 'react';
import { Grid } from '@mui/material';
import ServiceCard from './ServiceCard';
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3001', {
  transports: ['websocket'], // Ensure WebSocket connection
});

function ServiceGrid() {
  const [services, setServices] = useState([]);

  useEffect(() => {
    socket.on('connect', () => {
    });

    socket.on('disconnect', () => {
    });

    socket.on('servicesUpdate', (updatedServices) => {
      setServices(updatedServices);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('servicesUpdate');
    };
  }, []);

  return (
    <Grid container spacing={3}>
      {services.length > 0 ? (
        services.map((service) => (
          <Grid item xs={12} md={4} key={service.name}>
            <ServiceCard 
              name={service.name}
              status={service.status ? 'up' : 'down'}
              latency={service.responseTime}
              uptime={service.uptime}
            />
          </Grid>
        ))
      ) : (
        <p>Loading services...</p>
      )}
    </Grid>
  );
}

export default ServiceGrid;
