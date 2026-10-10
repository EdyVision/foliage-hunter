module.exports = ({ config }) => {
  const appJson = require('./app.json');
  return {
    ...config,
    ...appJson.expo,
  };
};
