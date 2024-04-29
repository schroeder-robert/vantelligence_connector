# Vantelligence Connector

A MQTT connector for devices, sensors and programms mostly used in camper vans. With support for Home Assistant.

<br>

## Setup

1. Run the install script:

        curl -o- https://raw.githubusercontent.com/schroeder-robert/vantelligence_connector/develop/install.sh | sudo bash

2. Choose on of the config files in the `connector/config` folder and rename it to `config.yaml`.

    Alternatively you can build your own config from the blocks from `Supported devices/sensors/programs` if you use a custom setup.

3. Restart & you're ready

<br>

## Running

After successfull start you will see some new topics in yout MQTT broker.

Your configuration will be published in this topic:

    connector/config

All entities and their states will be published here:

    connector/devices

<br>

## Supported devices/sensors/programs

You can add this config blocks to your `config.yaml` to activate MQTT publishing to your broker.
Every device has at least an `id` and a `name` which you can define. That way ist is possible to read two oder more sensors of the same type.

<br>

### DS18B20 Temperature Sensor

A simple and very common temperature sensor. You can define the polling interval. It is connected by 1-wire bus, so make sure that it is activated. (Raspberry Pi: `raspi-config`)

    - name: Temperaturesensor
      id: temperaturesensor
      class: DS18B20
      interval: 20000

<br>

### ADS1115 ADC

A 4-channel 16bit analog to digital converter. It is connected by I2C bus.
You can define the polling interval and the channels.

    - name: Analogsensor
      id: analogsensor
      class: ADS1115
      interval: 3000
      connection:
        type: i2c
        bus: 1
        address: 0x48
      values:
      - name: A0
        measure: 0+GND
        min: 0
        max: 65535
        scale: 100
        unit: "%"
      - name: A1
        measure: 1+GND
        min: 0
        max: 65535
        scale: 100
        unit: "%"
      - name: A2
        measure: 2+GND
        min: 0
        max: 65535
        scale: 100
        unit: "%"
      - name: A3
        measure: 3+GND
        min: 0
        max: 65535
        scale: 100
        unit: "%"

<br>

### MCP23017 I/O Expander

A 16bit I/O Expander. It is connected by I2C bus.

    - name: I/O Expander
      id: ioexpander
      class: MCP23017
      connection:
        type: i2c
        bus: 1
        address: 0x20
      pins:
      - name: Input0
        id: 0
        type: in
        inverted: true
      - name: Input1
        id: 1
        type: in
        inverted: true
      - name: Input2
        id: 2
        type: in
        inverted: true
      - name: Input3
        id: 3
        type: in
        inverted: true
      - name: Input4
        id: 4
        type: in
        inverted: true
      - name: Input5
        id: 5
        type: in
        inverted: true
      - name: Input6
        id: 6
        type: in
        inverted: true
      - name: Input7
        id: 7
        type: in
        inverted: true
      - name: Output0
        id: 8
        type: out
      - name: Output1
        id: 9
        type: out
      - name: Output2
        id: 10
        type: out
      - name: Output3
        id: 11
        type: out
      - name: Output4
        id: 12
        type: out
      - name: Output5
        id: 13
        type: out
      - name: Output6
        id: 14
        type: out
      - name: Output7
        id: 15
        type: out

<br>

### MPU 6050 Motion Sensor

A six axis gyro, accelerometer and thermometer. It is connected by I2C bus.

    - name: Motion Sensor
      id: motionsensor
      class: MPU_6050
      connection:
        type: i2c
        bus: 1
        address: 0x68

<br>

### PCA9685 PWM Driver

A 16-channel 12bit PWM servo driver. It is connected by I2C bus.

    - name: PWM-Controller
      id: pwmcontroller
      class: PCA9685
      connection:
        type: i2c
        bus: 1
        address: 0x40
      channels:
      - name: Licht Schiebetür links
        id: 0
        type: light
      - name: Licht Laderaum
        id: 1
        type: light
      - name: Licht Schiebetür rechts
        id: 2
        type: light
      - name: Licht Dachluke
        id: 3
        type: light
      - name: Licht5
        id: 4
        type: light
      - name: Schubladenverrieglung
        id: 14
        min: 400
        max: 2600
        scale: 180
      - name: Kühlschrankverrieglung
        id: 15
        min: 400
        max: 2600
        scale: 180

<br>

### BH1750 Light Sensor

A light sensor. It is connected by I2C bus.

    - name: Light Sensor
      id: lightsensor
      class: BH1750
      connection:
        type: i2c
        bus: 1
        address: 0x23

<br>

### Votronic VCC 1212-30

A battery-to-battery charger which can handle 30A. It is connected by a serial interface.

    - name: B2B-Laderegler
      id: b2b_laderegler
      class: Votronic_VCC_1212
      connection:
      type: serial
      port: "/dev/ttyUSBCharger"

<br>

### Ective DSC

A solar charger. It is connected by serial interface.

    - name: Solar-Laderegler
      id: solar_laderegler
      class: Ective_DSC
      connection:
      type: serial
      port: "/dev/ttyUSBSolar"

<br>

### Ective CSI (GPIO)

A 230V inverter. It is connected by GPIO pins which control power (on/off) and mode (usp/eco) and read status data.

    - name: Wechselrichter
      id: wechselrichter
      class: Ective_CSI
      connection:
      type: pins
      power_pin: 13
      mode_pin: 19
      data_pin: 26

<br>

### Autoterm Air 2D

A 2 kW diesel heater. It is connected by serial interface. 

    - name: Dieselheizung
      id: dieselheizung
      class: Autoterm_Air_2D
      subscribe:
      temperature_current: connector/device/luftsensor/temperature/state
      connection:
      type: serial
      port: "/dev/ttyUSBHeater"

<br>

### Raspberry Pi GPIO

**⚠ Important System Requirements**

Disable GPIO interrupts ([source](https://github.com/jperkin/node-rpio?tab=readme-ov-file#disable-gpio-interrupts))

If running a newer Raspbian release, you will need to add the following line to
`/boot/config.txt` and reboot:

```
dtoverlay=gpio-no-irq
```

Without this you may see crashes with newer kernels when trying to poll for pin
changes.

Use GPIO pins of a Raspberry Pi as input, output or pwm as swi.

    - name: GPIO
      id: gpio
      class: GPIO
      pins:
      - name: Dashcam
        type: out
        id: 24
        inverted: true
      - name: Wasserpumpe
        type: out
        id: 31
        inverted: true
      - name: Kühlschrank
        type: out
        id: 36
        inverted: true
      - name: B2B Laderegler
        type: out
        id: 38
        inverted: true
      - name: Soundsystem
        type: out
        id: 22
        inverted: true
      - name: Relais 1
        type: out
        id: 26
        inverted: true
      - name: Abwasserventil zu
        type: out
        id: 16
        inverted: true
      - name: Abwasserventil auf
        type: out
        id: 28
        inverted: true
      - name: Wasserboiler
        type: out
        id: 8
        inverted: true
      - name: 'Kochstelle'
        type: out
        id: 10
        inverted: true
      - name: Schalter Dachluke
        type: in
        id: 7
        pull: up
        inverted: true
      - name: Haupttaster
        type: in
        id: 40
        pull: up
        inverted: true

<br>

### Pulseaudio

Control volume and select sink from Pulse Audio.

    - name: Soundsystem
      id: sound
      class: Pulseaudio
      controls:
      - name: Main
        id: Master

<br>

## Autostart


    [Unit]
    Description=Connector
    After=network.target

    [Service]
    ExecStart=/usr/bin/node /home/rob/connector/app.js
    Restart=on-failure
    User=root
    Group=root
    Environment=PATH=/usr/bin:/usr/local/bin
    Environment=NODE_ENV=production
    WorkingDirectory=/home/rob/connector/

    [Install]
    WantedBy=multi-user.target