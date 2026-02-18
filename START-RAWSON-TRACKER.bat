services:
  - type: web
    name: rawson-tracker
    env: node
    region: frankfurt
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: JWT_SECRET
        generateValue: true
      - key: SESSION_SECRET
        generateValue: true
