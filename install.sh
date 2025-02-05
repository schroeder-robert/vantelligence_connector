#!/bin/bash

if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

# Pi config
echo "Configuring Pi"

echo "dtoverlay=gpio-no-irq" >> "/boot/config.txt"

# Git installation
echo "Installing Git"

apt-get install git > /dev/null

# Node.js installation
echo "Installing Node.js"

curl -fsSL https://deb.nodesource.com/setup_18.x | -E bash - &&\
apt-get install -y nodejs

npm install --quiet -g node-gyp > /dev/null

# Repo cloning
echo "Cloning repo"

git clone https://github.com/schroeder-robert/vantelligence_connector.git connector-test &> /dev/null

cd connector-test

echo "NPM Install"

npm install > /dev/null

# Docker installation
# curl -fsSL https://get.docker.com -o get-docker.sh
# sh get-docker.sh

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