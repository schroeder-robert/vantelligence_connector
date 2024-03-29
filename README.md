# Connector

Config goes into this topic:

    connector/config

## Examlpe config

    support:
    - homeassistant
    devices:
    - name: Befehle
      id: command
      class: Command
    - name: Bluetooth
      id: bluetooth
      class: Bluetooth
    - name: HS-Can
      id: hscan
      class: Socketcan
      connection:
        bus: can0
    - name: PWM-Controller
      id: pwmcontroller
      class: PCA9685
      connection:
        type: i2c
        bus: 1
      channels:
      - id: 0
        name: Test-0
        min: 400
        max: 2600
        scale: 180
      - id: 1
        name: Test-1
        min: 400
        max: 2600
        scale: 180
      - id: 2
        name: Test-2
        min: 400
        max: 2600
        scale: 180
    - name: Analogsensor
      id: analogsensor
      class: ADS1115
      connection:
        type: i2c
        bus: 1
        interval: 3000
      values:
      - name: A0
        measure: 0+GND
        min: 0
        max: 65535
        scale: 1
        unit: l
      - name: A1
        measure: 1+GND
        min: 0
        max: 65535
        scale: 1
        unit: l
      - name: Abwasser
        measure: 2+GND
        min: 1400
        max: 14000
        scale: 78
        unit: l
      - name: Frischwasser
        measure: 3+GND
        min: 0
        max: 14400
        scale: 110
        unit: l
    - name: Luftsensor
      id: luftsensor
      class: BME280
      connection:
        type: i2c
        bus: 1
    - name: Helligkeitssensor
      id: helligkeitssensor
      class: BH1750
      connection:
        type: i2c
        bus: 1
    - name: Bewegungssensor
      id: bewegungssensor
      class: MPU_6050
      connection:
        type: i2c
        bus: 1
    - name: B2B-Laderegler
      id: b2b_laderegler
      class: Votronic_VCC_1212
      connection:
        type: serial
        port: "/dev/ttyUSBCharger"
    - name: Solar-Laderegler
      id: solar_laderegler
      class: Ective_DSC
      connection:
        type: serial
        port: "/dev/ttyUSBSolar"
    - name: Wechselrichter
      id: wechselrichter
      class: Ective_CSI
      connection:
        type: pins
        power_pin: 17
        mode_pin: 27
        data_pin: 22
    - name: Dieselheizung
      id: dieselheizung
      class: Autoterm_Air_2D
      subscribe:
        temperature_current: connector/device/luftsensor/temperature/state
      connection:
        type: serial
        port: "/dev/ttyUSBHeater"
    - name: GPIO-NEW
      id: gpio-new
      class: GPIO
      pins:
      - name: 'Relais #1'
        type: out
        id: 18
    - name: GPIO
      id: gpio
      class: Pigpio
      connection:
        host: localhost
      pins:
      - name: Dashcam
        type: out
        id: 8
        inverted: true
      - name: Wasserpumpe
        type: out
        id: 12
        inverted: true
      - name: Kühlschrank
        type: out
        id: 16
        inverted: true
      - name: B2B Laderegler
        type: out
        id: 20
        inverted: true
      - name: Soundsystem
        type: out
        id: 25
        inverted: true
      - name: Relais 1
        type: out
        id: 0
        inverted: true
      - name: Relais 2
        type: out
        id: 23
        inverted: true
      - name: Relais 3
        type: out
        id: 7
        inverted: true
      - name: Wasserboiler
        type: out
        id: 14
        inverted: true
      - name: '230V #2'
        type: out
        id: 15
        inverted: true
      - name: Display
        type: out
        id: 24
      - name: Licht1
        type: pwm
        id: 5
      - name: Licht2
        type: pwm
        id: 6
      - name: Licht3
        type: pwm
        id: 13
      - name: Licht4
        type: pwm
        id: 19
      - name: Licht Dachluke
        type: pwm
        id: 26
      - name: Schalter Dachluke
        type: in
        id: 4
        inverted: true
      - name: Haupttaster
        type: in
        pull: up
        id: 21
    - name: Soundsystem
      id: sound
      class: Pulseaudio
      controls:
      - name: Main
        id: Master
