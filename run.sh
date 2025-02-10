#!/usr/bin/env bashio

echo "Hello world!"

export MQTT_HOST=$(bashio::services mqtt "host")
export MQTT_USER=$(bashio::services mqtt "username")
export MQTT_PASSWORD=$(bashio::services mqtt "password")

bashio::log.info "${MQTT_HOST}"

node /connector/app.js