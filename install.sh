#!/bin/bash

# Git installation
echo "Installing Git"

apt-get install git

# Node.js installation
echo "Installing Node.js"

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - &&\
sudo apt-get install -y nodejs

npm install -g node-gyp

# Repo cloning
echo "Cloning repo"

git clone https://github.com/schroeder-robert/vantelligence_connector.git

# # Docker installation
# curl -fsSL https://get.docker.com -o get-docker.sh
# sudo sh get-docker.sh

# # Starting Mosquitto container
# docker run -d \
#   --name mosquitto \
#   --restart=unless-stopped \
#   -p 1883:1883 \
#   -p 9001:9001 \
#   -v ./apps/mosquitto:/mosquitto/config \
#   -v /mosquitto/data \
#   -v /mosquitto/log \
#   eclipse-mosquitto


# # Starting Home Assistant container
# docker run -d \
#   --name homeassistant \
#   --privileged \
#   --restart=unless-stopped \
#   -e TZ=MY_TIME_ZONE \
#   -v /PATH_TO_YOUR_CONFIG:/config \
#   --network=host \
#   ghcr.io/home-assistant/home-assistant:stable