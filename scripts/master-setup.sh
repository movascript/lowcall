#!/bin/bash
# master-setup.sh - Run all setup scripts in order

set -e

echo "=== LowCall.com Complete Setup ==="
echo "This will setup the entire server infrastructure"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Make all scripts executable
chmod +x setup-server.sh
chmod +x setup-socketio-server.sh
chmod +x setup-nginx.sh
chmod +x setup-ssl.sh
chmod +x setup-coturn.sh
chmod +x deploy-client.sh

# Run setup scripts
./setup-server.sh
./setup-socketio-server.sh
./setup-nginx.sh

echo ""
echo "=== Basic setup complete ==="
echo "Before continuing, please:"
echo "1. Update your DNS records to point to this server"
echo "2. Edit setup-ssl.sh and change the email address"
echo "3. Get your server's public IP and update setup-coturn.sh"
echo ""
read -p "Ready to continue with SSL and TURN setup? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ./setup-ssl.sh
    ./setup-coturn.sh
fi

echo ""
echo "=== Setup Complete ==="
echo "To deploy your React app, run: ./deploy-client.sh"
