#!/bin/bash

# Uninstall unofficial Docker packages
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do sudo apt-get remove $pkg; done

# Add Docker's official GPG key
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update

# Install Docker
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Set up app directory
sudo mkdir /app
sudo useradd -r -s /bin/false -d /app appuser
sudo chown -R appuser:appuser /app
sudo chmod -R 755 /app

sudo -u appuser git clone https://github.com/nullomatic/wordbook /app

DIR="$(dirname "$(readlink -f "$0")")"
cp "$DIR/wordbook.service" /etc/systemd/system/
sudo systemctl enable --now wordbook.service

