#!/bin/bash
# deploy-client.sh - Build and deploy React client

set -e

CLIENT_DIR="/var/www/lowcall-client"

echo "=== Deploying React Client ==="

# Build React app (run from client directory)
cd ./client
echo "Building React app..."
npm install
npm run build

# Deploy to server
echo "Deploying to $CLIENT_DIR..."
sudo rm -rf $CLIENT_DIR/*
sudo cp -r dist/* $CLIENT_DIR/
sudo chown -R www-data:www-data $CLIENT_DIR

echo "=== Client Deployment Complete ==="
