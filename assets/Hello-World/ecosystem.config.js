module.exports = {
  apps: [
    {
      name: 'opencode-engine',
      script: 'opencode',
      args: 'serve --port 21294',
      env: {
        PORT: 21294,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'proxy-3000',
      script: 'node',
      args: 'artifacts/opencode-ui/proxy.mjs',
      env: {
        PORT: 3000,
        OPENCODE_INTERNAL_PORT: 21294,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'web-operator',
      script: 'node',
      args: 'web-operator/api-server.js',
      env: {
        PORT: 3001,
        OPERATOR_PORT: 3001,
        NODE_ENV: 'production'
      }
    }
  ]
};
