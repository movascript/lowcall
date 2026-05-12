#!/bin/bash
# setup-socketio-server.sh - Setup Socket.IO server with PM2

set -e

SERVER_DIR="/var/www/lowcall-server"

echo "=== Setting up Socket.IO Server ==="

# Create server directory
sudo mkdir -p $SERVER_DIR

# Copy server files
echo "Copying server files..."
sudo cp -r ./server/* $SERVER_DIR/
sudo chown -R $USER:$USER $SERVER_DIR

# Install dependencies
echo "Installing dependencies..."
cd $SERVER_DIR
npm install express socket.io

# Install PM2 globally
echo "Installing PM2..."
sudo npm install -g pm2

# Start with PM2
echo "Starting server with PM2..."
pm2 start server.js --name lowcall-socket --env production

# Save PM2 process list and enable startup
pm2 save
pm2 startup | tail -1 | sudo bash

echo "=== Done ==="
pm2 status
