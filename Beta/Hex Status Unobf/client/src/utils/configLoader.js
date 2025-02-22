import yaml from 'js-yaml';

const loadConfig = async () => {
  const response = await fetch('/config.yml');
  const yamlText = await response.text();
  return yaml.load(yamlText);
};

export default loadConfig();