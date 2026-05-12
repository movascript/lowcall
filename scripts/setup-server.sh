#!/bin/bash
# setup-server.sh - Complete server setup script

set -e

echo "=== Starting Server Setup ==="

# Update system
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js
echo "Installing Node.js..."
sudo apt install -y nodejs npm

# Install build essentials
sudo apt install -y build-essential

# Verify installations
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Install Nginx
echo "Installing Nginx..."
sudo apt install -y nginx

# Install Certbot for SSL
echo "Installing Certbot..."
sudo apt install -y certbot python3-certbot-nginx

# Setup UFW Firewall
echo "Installing UFW"
sudo apt install -y ufw
echo "Configuring UFW Firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow 3000/tcp  # Socket.io server port
sudo ufw allow 3478/tcp  # STUN/TURN
sudo ufw allow 3478/udp
sudo ufw allow 49152:65535/udp  # TURN relay ports
sudo ufw --force enable

# Install Coturn (STUN/TURN server)
echo "Installing Coturn..."
sudo apt install -y coturn

echo "=== Server Setup Complete ==="
echo "Next steps:"
echo "1. Run setup-socketio-server.sh to configure the Socket.IO server"
echo "2. Run setup-nginx.sh to configure Nginx"
echo "3. Run setup-coturn.sh to configure STUN/TURN server"
