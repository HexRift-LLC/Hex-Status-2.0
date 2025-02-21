import React from 'react';
import ServiceGrid from '../components/ServiceGrid';
import StatusSummary from '../components/StatusSummary';

function Dashboard() {
  return (
    <div className="dashboard">
      <StatusSummary />
      <ServiceGrid />
    </div>
  );
}

export default Dashboard;
