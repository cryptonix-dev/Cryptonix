#!/bin/bash

# Ubuntu VPS Deployment Script for Cryptonix
set -e

echo "🚀 Deploying Cryptonix to Ubuntu VPS..."

# Navigate to application directory
cd /var/www/cryptonix

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Navigate to website directory
cd website

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Build the application
echo "🔨 Building application..."
npm run build

# Create logs directory if it doesn't exist
mkdir -p logs

# Restart PM2 process
echo "🔄 Restarting application..."
pm2 reload ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

echo "✅ Deployment completed successfully!"
echo "📊 Check status with: pm2 status"
echo "📝 Check logs with: pm2 logs cryptonix"
