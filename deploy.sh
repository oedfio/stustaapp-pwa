#!/bin/bash
# Build the frontend and fix permissions in one command

echo "Building frontend..."
cd /srv/stustaapp/frontend
npm run build

echo "Fixing permissions..."
chown -R www-data:www-data /srv/stustaapp/frontend/dist

echo "Done! Frontend deployed successfully."