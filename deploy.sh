#!/bin/bash
set -e
cd /srv/stustaapp
git pull origin main
source backend/venv/bin/activate
pip install -r backend/requirements.txt
cd backend
alembic upgrade head
cd ../frontend
npm install
npm run build
cd ..
sudo chown -R stustaapp:stustaapp /srv/stustaapp
sudo systemctl restart stustaapp
echo "Deployed $(git rev-parse --short HEAD)"