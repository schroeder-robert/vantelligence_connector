#!/bin/sh

export CONNECTOR_MQTT_USERNAME=test
export CONNECTOR_MQTT_PASSWORD=test

cd src
#nodemon -e js,yaml
/home/rob/.nvm/versions/node/v22.13.0/bin/node app.js