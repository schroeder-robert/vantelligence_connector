#!/bin/sh

export CONNECTOR_MQTT_USERNAME=test
export CONNECTOR_MQTT_PASSWORD=test

cd src
nodemon -e js,yaml