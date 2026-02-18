{
  "name": "rawson-agent-tracker-cloud",
  "version": "2.0.0",
  "description": "Rawson Properties Agent Activity Tracker - Cloud-Synced Multi-User System",
  "main": "server/server.js",
  "scripts": {
    "start": "node server/server.js",
    "dev": "nodemon server/server.js",
    "build": "echo 'No build needed for this version'",
    "setup": "node server/setup.js"
  },
  "keywords": ["real-estate", "tracker", "commission", "cloud-sync"],
  "author": "Rawson Properties",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "better-sqlite3": "^9.2.2",
    "dotenv": "^16.3.1",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "validator": "^13.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
