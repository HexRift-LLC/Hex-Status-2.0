let servicesState = [];

const getServicesState = () => servicesState;
const updateServicesState = (newState) => {
  servicesState = newState;
};

module.exports = { getServicesState, updateServicesState };
