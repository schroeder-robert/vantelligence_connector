# Connector

Config goes into this topic:

    connector/config

## Examlpe config

    {
      "support": [
        "homeassistant"
      ],
      "devices": [
        {
          "name": "Luftsensor",
          "id": "luftsensor",
          "class": "BME280",
          "connection": {
            "type": "i2c",
            "bus": 1
          }
        },
        {
          "name": "Helligkeitssensor",
          "id": "helligkeitssensor",
          "class": "BH1750",
          "connection": {
            "type": "i2c",
            "bus": 1
          }
        },
        {
          "name": "Bewegungssensor",
          "id": "bewegungssensor",
          "class": "MPU_6050",
          "connection": {
            "type": "i2c",
            "bus": 1
          }
        },
        {
          "name": "B2B-Laderegler",
          "id": "b2b_laderegler",
          "class": "Votronic_VCC_1212",
          "connection": {
            "type": "serial",
            "port": "/dev/ttyUSB1"
          }
        },
        {
          "name": "Solar-Laderegler",
          "id": "solar_laderegler",
          "class": "Ective_DSC",
          "connection": {
            "type": "serial",
            "port": "/dev/ttyUSB0"
          }
        },
        {
          "name": "Dieselheizung",
          "id": "dieselheizung",
          "class": "Autoterm_Air_2D",
          "subscribe": {
            "temperature_current": "connector/device/luftsensor/temperature/state"
          },
          "connection": {
            "type": "serial",
            "port": "/dev/ttyUSB2"
          }
        }
      ]
    }