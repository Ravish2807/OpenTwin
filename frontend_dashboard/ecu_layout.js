/**
 * OpenTwin: AUTOSAR E/E Architecture Suite & ECU Network Layout
 * Follows official AUTOSAR (AUTomotive Open System ARchitecture) Classic Platform Release 4.4.0
 * and AUTOSAR Adaptive Platform Release R22-11 standards.
 * 
 * Layers:
 * 1. Application Layer (ASW) - Software Components (SWCs), Ports (P-Port / R-Port), Interfaces, Runnables
 * 2. Runtime Environment (RTE) - Virtual Functional Bus (VFB) Abstraction & Signal Buffers
 * 3. Basic Software (BSW):
 *    - Services Layer (OS, EcuM, BswM, WdgM, Com, PduR, CanNm, CanSM, Dcm, Dem, NvM)
 *    - ECU Abstraction Layer (CanIf, CanTp, IoHwAb, MemIf, Fee)
 *    - Microcontroller Abstraction Layer (MCAL) (CanDrv, Mcu, Port, Dio, Adc, Gpt, Fls)
 * 4. Microcontroller Hardware (Silicon MCU, CAN Transceiver, Physical CAN_H / CAN_L Bus)
 */

export class EcuLayoutManager {
  constructor() {
    this.activeLayout = 'distributed'; // 'distributed' | 'domain' | 'zonal' | 'ev'
    this.activeView = 'autosar'; // 'autosar' | 'topology' | 'arxml'
    this.selectedNodeId = 'ECU_ENGINE';
    this.selectedModuleId = 'COM';
    this.latestTelemetry = {};
    this.packetCounters = {
      ECU_ENGINE: 1420,
      ECU_BODY: 980,
      ECU_DIAG: 410,
      ECU_DASHBOARD: 2150
    };

    this.initDataModels();
    this.initDOM();
  }

  initDataModels() {
    this.topologies = {
      distributed: {
        name: 'Classical Distributed CAN 2.0B (AUTOSAR Classic)',
        badge: '● AUTOSAR CLASSIC 4.4.0 — DISTRIBUTED CAN (500 kbps)',
        proto: 'ISO 11898-2 Classical CAN / AUTOSAR CP R4.4.0',
        baud: '500 kbps',
        term: '120 Ω (Split Dual End-Points)',
        busLoad: '28.4%',
        nodes: [
          {
            id: 'ECU_ENGINE',
            name: 'ECU_ENGINE (Engine Management System)',
            type: 'POWERTRAIN CONTROLLER',
            icon: '⚙️',
            canIdHex: '0x100',
            canIdDec: 256,
            cycleTime: '10 ms (100 Hz)',
            dlc: '8 Bytes',
            payloadType: 'Standard DBC (vehicle_base.dbc)',
            status: 'ONLINE',
            pinout: 'CAN_H (Pin 7), CAN_L (Pin 2), KL15 (Ignition), KL30 (Batt+)',
            signals: ['EngineSpeed', 'VehicleSpeed', 'ThrottlePosition', 'EngineTemp', 'OilPressure'],
            description: 'Supervises internal combustion powertrain dynamics, fuel injection mapping, throttle drive-by-wire, and lubrication pressure.',
            autosar: {
              platform: 'AUTOSAR Classic Platform (CP)',
              release: 'Release 4.4.0 (R20-11)',
              safetyRating: 'ISO 26262 ASIL-D',
              targetSilicon: {
                mcu: 'Infineon AURIX™ TC397XP (32-bit Triple TriCore™ @ 300 MHz)',
                cores: '6 Cores (4 Lockstep Cores, 2 Non-Lockstep)',
                flash: '16 MB On-Chip Flash (with HSM Cryptographic Hardware)',
                ram: '6.9 MB SRAM (with ECC)',
                transceiver: 'NXP TJA1044GT High-Speed CAN Transceiver (Galvanically Isolated 2.5 kV)'
              },
              swcs: [
                {
                  name: 'EngineCtrl_SWC',
                  type: 'Atomic Application Software Component',
                  desc: 'Core powertrain governor executing cylinder torque curves, fuel injection metering, and ignition spark timing.',
                  ports: [
                    { name: 'ppEngine_Data', type: 'P-PORT (Provided)', iface: 'SR_EngineData_IF', signals: ['EngineSpeed', 'VehicleSpeed', 'EngineTemp', 'OilPressure'] },
                    { name: 'rpDriverDemand', type: 'R-PORT (Required)', iface: 'SR_ThrottleDemand_IF', signals: ['ThrottlePosition'] }
                  ],
                  runnables: [
                    { name: 'Runnable_10ms_CalcEngineTorque', trigger: 'TimingEvent (10ms Periodic)', prio: 20 },
                    { name: 'Runnable_100ms_ThermalSupervision', trigger: 'TimingEvent (100ms Periodic)', prio: 5 }
                  ]
                },
                {
                  name: 'ThrottleDriveByWire_SWC',
                  type: 'Sensor-Actuator Software Component',
                  desc: 'Electronic throttle pedal position sensor aggregation and dual-potentiometer plausibility supervision.',
                  ports: [
                    { name: 'ppThrottleActuator', type: 'P-PORT (Provided)', iface: 'SR_ThrottleActuator_IF', signals: ['ThrottlePosition'] },
                    { name: 'rpAdcPedalSensors', type: 'R-PORT (Required)', iface: 'CS_AdcSampling_IF', signals: ['RawADC_Channel_0', 'RawADC_Channel_1'] }
                  ],
                  runnables: [
                    { name: 'Runnable_5ms_PedalSampling', trigger: 'TimingEvent (5ms Periodic)', prio: 25 }
                  ]
                },
                {
                  name: 'EngineDiag_SWC',
                  type: 'Service Software Component',
                  desc: 'Monitors engine knock, misfire, and overspeed thresholds, routing fault notifications to the Dem.',
                  ports: [
                    { name: 'rpDem_EngineEvents', type: 'R-PORT (Required)', iface: 'CS_DiagnosticMonitor_IF', signals: ['DTC_0x0100_EngineOverspeed'] }
                  ],
                  runnables: [
                    { name: 'Runnable_OnDtcEvent', trigger: 'OperationInvokedEvent (On Fault)', prio: 10 }
                  ]
                }
              ],
              rte: {
                desc: 'AUTOSAR Runtime Environment (VFB). Mediates intra-ECU runnable memory transfers and abstracts BSW COM communication stack.',
                apis: [
                  'Std_ReturnType Rte_Read_rpDriverDemand_ThrottlePosition(uint8* val)',
                  'Std_ReturnType Rte_Write_ppEngine_Data_EngineSpeed(uint16 speed)',
                  'Std_ReturnType Rte_Write_ppEngine_Data_VehicleSpeed(uint16 speed)',
                  'Std_ReturnType Rte_Write_ppEngine_Data_EngineTemp(sint8 temp)',
                  'Std_ReturnType Rte_Write_ppEngine_Data_OilPressure(uint16 pressure)'
                ]
              },
              bsw: {
                services: [
                  { id: 'COM', name: 'AUTOSAR COM', cat: 'Communication', desc: 'Packs and unpacks signals to/from I-PDUs. Manages transmission modes (Cyclic 10ms, Event-Driven).', apis: ['Com_SendSignal()', 'Com_ReceiveSignal()', 'Com_MainFunctionRx()', 'Com_MainFunctionTx()'] },
                  { id: 'PDUR', name: 'PDU Router (PduR)', cat: 'Communication', desc: 'Zero-overhead I-PDU gateway routing packets between Com, Dcm, and CanIf interfaces.', apis: ['PduR_CanIfRxIndication()', 'PduR_ComTransmit()', 'PduR_CanIfTxConfirmation()'] },
                  { id: 'CANSM', name: 'CAN State Manager', cat: 'Communication', desc: 'Controls network states: CANSM_BSWM_FULL_COMMUNICATION, NO_COMMUNICATION.', apis: ['CanSM_Init()', 'CanSM_RequestComMode()'] },
                  { id: 'CANNM', name: 'CAN Network Mgmt', cat: 'Communication', desc: 'Synchronizes bus sleep and wake-up transitions across distributed network nodes.', apis: ['CanNm_Transmit()', 'CanNm_NetworkRequest()'] },
                  { id: 'OS', name: 'AUTOSAR OS (OSEK-VDX)', cat: 'System', desc: 'Static preemptive priority-based multi-tasking kernel with Schedule Tables and Category 2 ISRs.', apis: ['ActivateTask(Task_10ms)', 'TerminateTask()', 'GetResource()'] },
                  { id: 'ECUM', name: 'ECU State Manager', cat: 'System', desc: 'Governs ECU lifecycle states: STARTUP (Phase 1/2) -> RUN -> POST_RUN -> SHUTDOWN / SLEEP.', apis: ['EcuM_StartupTwo()', 'EcuM_GoToSelectedShutdown()'] },
                  { id: 'BSWM', name: 'BSW Mode Manager', cat: 'System', desc: 'Evaluates mode arbitration rules and triggers BSW state transitions and task activations.', apis: ['BswM_RequestMode()', 'BswM_MainFunction()'] },
                  { id: 'WDGM', name: 'Watchdog Manager', cat: 'System', desc: 'Provides Alive, Deadline, and Logical execution path supervision for ASIL-D safety requirements.', apis: ['WdgM_CheckpointReached()', 'WdgM_PerformReset()'] },
                  { id: 'DCM', name: 'Diagnostic Com (Dcm)', cat: 'Diagnostics', desc: 'Executes ISO 14229 UDS diagnostic services: 0x10 (Session), 0x22 (ReadDataById), 0x19 (ReadDTC), 0x27 (Security).', apis: ['Dcm_GetActiveProtocol()', 'Dcm_ProcessingDone()'] },
                  { id: 'DEM', name: 'Diagnostic Event (Dem)', cat: 'Diagnostics', desc: 'Manages Diagnostic Trouble Codes (DTCs), Freeze Frame data records, and MIL lamp status.', apis: ['Dem_SetEventStatus()', 'Dem_GetEventStatus()'] },
                  { id: 'NVM', name: 'Non-Volatile Memory (NvM)', cat: 'Memory', desc: 'Controls non-volatile data storage blocks in Flash EEPROM Emulation with CRC32 integrity checks.', apis: ['NvM_ReadBlock()', 'NvM_WriteBlock()'] }
                ],
                abstraction: [
                  { id: 'CANIF', name: 'CAN Interface (CanIf)', cat: 'ECU Abstraction', desc: 'Hardware-independent CAN controller and transceiver abstraction layer. Routes Tx/Rx indications.', apis: ['CanIf_Transmit()', 'CanIf_RxIndication()', 'CanIf_SetControllerMode()'] },
                  { id: 'CANTP', name: 'CAN Transport (CanTp)', cat: 'ECU Abstraction', desc: 'ISO 15765-2 multi-frame segmentation and reassembly (Single Frame, First Frame, Consecutive, Flow Control).', apis: ['CanTp_Transmit()', 'CanTp_RxIndication()'] },
                  { id: 'IOHWAB', name: 'I/O HW Abstraction', cat: 'ECU Abstraction', desc: 'Abstracts physical microcontroller pinouts (ADC, PWM, DIO) into standardized signal levels.', apis: ['IoHwAb_GetPedalVoltage()', 'IoHwAb_SetIgnitionCoil()'] },
                  { id: 'MEMIF', name: 'Memory Abstraction (MemIf)', cat: 'ECU Abstraction', desc: 'Uniform API for EEPROM Driver (Eep) and Flash EEPROM Emulation (Fee).', apis: ['MemIf_Read()', 'MemIf_Write()'] }
                ],
                mcal: [
                  { id: 'CANDRV', name: 'CAN Driver (CanDrv)', cat: 'MCAL', desc: 'Directly accesses Infineon MultiCAN+ controller registers, manages hardware transmit FIFO mailboxes and masks.', apis: ['Can_Write()', 'Can_MainFunction_Write()', 'Can_MainFunction_Read()'] },
                  { id: 'MCU', name: 'Microcontroller (Mcu)', cat: 'MCAL', desc: 'Initializes TriCore PLL clock distribution, system oscillators, reset reason identification, and low-power modes.', apis: ['Mcu_InitClock()', 'Mcu_DistributePllClock()'] },
                  { id: 'PORT', name: 'Port Driver (Port)', cat: 'MCAL', desc: 'Configures microcontroller pin direction, pull-up/pull-down resistors, and pin multiplexer alternate functions.', apis: ['Port_Init()', 'Port_SetPinDirection()'] },
                  { id: 'DIO', name: 'Digital I/O (Dio)', cat: 'MCAL', desc: 'Provides atomic read/write access to physical GPIO pins and ports without bitmask race conditions.', apis: ['Dio_ReadChannel()', 'Dio_WriteChannel()'] },
                  { id: 'ADC', name: 'ADC Driver (Adc)', cat: 'MCAL', desc: 'Controls hardware 12-bit Analog-to-Digital Converter clusters and DMA continuous streaming buffers.', apis: ['Adc_StartGroupConversion()', 'Adc_ReadGroup()'] }
                ]
              }
            }
          },
          {
            id: 'ECU_BODY',
            name: 'ECU_BODY (Body Control Module - BCM)',
            type: 'CHASSIS & BODY CONTROLLER',
            icon: '💡',
            canIdHex: '0x200',
            canIdDec: 512,
            cycleTime: '20 ms (50 Hz)',
            dlc: '8 Bytes',
            payloadType: 'Standard DBC (vehicle_base.dbc)',
            status: 'ONLINE',
            pinout: 'CAN_H (Pin 7), CAN_L (Pin 2), LIN-Bus Master, KL31 (Ground)',
            signals: ['FuelLevel', 'BatterySOC', 'Gear', 'BrakeActive', 'TurnSignal', 'SteeringAngle', 'HeadlightsActive'],
            description: 'Controls exterior LED projector lighting, turn indicators, transmission gear state, hydraulic braking switch, and steering angle sensors.',
            autosar: {
              platform: 'AUTOSAR Classic Platform (CP)',
              release: 'Release 4.4.0 (R20-11)',
              safetyRating: 'ISO 26262 ASIL-B',
              targetSilicon: {
                mcu: 'NXP S32K344 (32-bit Arm® Cortex®-M7 Lockstep @ 160 MHz)',
                cores: 'Dual Cortex-M7 Lockstep Cores',
                flash: '4 MB Flash (with Hardware Security Engine HSE-B)',
                ram: '512 KB SRAM (ECC-protected)',
                transceiver: 'NXP TJA1051 High-Speed CAN Transceiver'
              },
              swcs: [
                {
                  name: 'LightingControl_SWC',
                  type: 'Application Software Component',
                  desc: 'Orchestrates headlamp high/low beam states, animated turn signals, and hazard warning light flashing.',
                  ports: [
                    { name: 'ppExteriorLights', type: 'P-PORT (Provided)', iface: 'SR_LightsStatus_IF', signals: ['HeadlightsActive', 'TurnSignal'] },
                    { name: 'rpLightingSwitch', type: 'R-PORT (Required)', iface: 'SR_DriverInputs_IF', signals: ['LightSwitchPosition'] }
                  ],
                  runnables: [
                    { name: 'Runnable_20ms_LightingManager', trigger: 'TimingEvent (20ms Periodic)', prio: 15 }
                  ]
                },
                {
                  name: 'ChassisTelemetry_SWC',
                  type: 'Sensor-Actuator Software Component',
                  desc: 'Reads hydraulic brake pressure switch, gear selector lever position, and steering wheel angle encoder.',
                  ports: [
                    { name: 'ppChassisStatus', type: 'P-PORT (Provided)', iface: 'SR_ChassisStatus_IF', signals: ['BrakeActive', 'Gear', 'SteeringAngle', 'FuelLevel', 'BatterySOC'] }
                  ],
                  runnables: [
                    { name: 'Runnable_10ms_ChassisSample', trigger: 'TimingEvent (10ms Periodic)', prio: 18 }
                  ]
                }
              ],
              rte: {
                desc: 'AUTOSAR RTE for BCM. Routes lighting and chassis signals to BSW COM for I-PDU broadcast at 0x200.',
                apis: [
                  'Std_ReturnType Rte_Read_rpLightingSwitch_State(uint8* state)',
                  'Std_ReturnType Rte_Write_ppExteriorLights_HeadlightsActive(boolean active)',
                  'Std_ReturnType Rte_Write_ppChassisStatus_BrakeActive(boolean active)',
                  'Std_ReturnType Rte_Write_ppChassisStatus_Gear(uint8 gear)',
                  'Std_ReturnType Rte_Write_ppChassisStatus_SteeringAngle(sint16 angle)'
                ]
              },
              bsw: {
                services: [
                  { id: 'COM', name: 'AUTOSAR COM', cat: 'Communication', desc: 'Packs Chassis & Lighting I-PDU 0x200 (DLC 8, 20ms periodic transmission).', apis: ['Com_SendSignal()', 'Com_ReceiveSignal()'] },
                  { id: 'PDUR', name: 'PDU Router (PduR)', cat: 'Communication', desc: 'Routes I-PDU between CanIf and Com.', apis: ['PduR_CanIfRxIndication()', 'PduR_ComTransmit()'] },
                  { id: 'OS', name: 'AUTOSAR OS', cat: 'System', desc: 'Priority-based task scheduler running 20ms lighting loop.', apis: ['ActivateTask(Task_20ms)'] },
                  { id: 'ECUM', name: 'ECU State Manager', cat: 'System', desc: 'Governs sleep modes and LIN/CAN wake-up bus events.', apis: ['EcuM_SetWakeupEvent()'] }
                ],
                abstraction: [
                  { id: 'CANIF', name: 'CAN Interface (CanIf)', cat: 'ECU Abstraction', desc: 'Buffers TX mailboxes and routes transmission requests to NXP FlexCAN driver.', apis: ['CanIf_Transmit()'] },
                  { id: 'IOHWAB', name: 'I/O HW Abstraction', cat: 'ECU Abstraction', desc: 'Drives high-side power switches for 12V automotive halogen/LED lamps.', apis: ['IoHwAb_SetHighBeam()'] }
                ],
                mcal: [
                  { id: 'CANDRV', name: 'FlexCAN Driver', cat: 'MCAL', desc: 'NXP FlexCAN peripheral driver with 64 Message Buffers and Rx FIFO.', apis: ['Can_Write()', 'Can_MainFunction_Write()'] },
                  { id: 'PORT', name: 'Port Driver', cat: 'MCAL', desc: 'Sets up pin directions for GPIO switches and LIN Transceiver.', apis: ['Port_Init()'] },
                  { id: 'DIO', name: 'Digital I/O Driver', cat: 'MCAL', desc: 'Atomic pin manipulation for relays and LED drivers.', apis: ['Dio_WriteChannel()'] }
                ]
              }
            }
          },
          {
            id: 'ECU_DIAG',
            name: 'ECU_DIAG (OBD-II Diagnostics Gateway)',
            type: 'DIAGNOSTIC & SAFETY GATEWAY',
            icon: '🛡️',
            canIdHex: '0x300',
            canIdDec: 768,
            cycleTime: '100 ms (10 Hz)',
            dlc: '8 Bytes',
            payloadType: 'Standard DBC (vehicle_base.dbc)',
            status: 'ONLINE',
            pinout: 'CAN_H (Pin 6), CAN_L (Pin 14), K-Line (Pin 7), SAE J1962',
            signals: ['CheckEngineLight', 'BatteryWarning', 'TirePressureWarning', 'ABSWarning', 'Odometer'],
            description: 'Maintains Diagnostic Trouble Codes (DTCs), Malfunction Indicator Lamps (MIL), tire pressure monitoring, ABS fault triggers, and tamper-proof odometer.',
            autosar: {
              platform: 'AUTOSAR Classic Platform (CP)',
              release: 'Release 4.4.0 (R20-11)',
              safetyRating: 'ISO 26262 ASIL-D',
              targetSilicon: {
                mcu: 'Renesas RH850/F1KM-S4 (32-bit Dual-Core Lockstep @ 240 MHz)',
                cores: 'Dual Core Lockstep CPU',
                flash: '4 MB Flash Memory',
                ram: '512 KB Local RAM',
                transceiver: 'Infineon TLE9250V CAN Transceiver'
              },
              swcs: [
                {
                  name: 'DiagnosticMaster_SWC',
                  type: 'Service Software Component',
                  desc: 'Gateway coordinator for ISO 14229 UDS diagnostic client sessions and SAE J1979 OBD-II requests.',
                  ports: [
                    { name: 'ppDiagnosticStatus', type: 'P-PORT (Provided)', iface: 'SR_DiagStatus_IF', signals: ['CheckEngineLight', 'BatteryWarning', 'TirePressureWarning', 'ABSWarning', 'Odometer'] }
                  ],
                  runnables: [
                    { name: 'Runnable_100ms_DiagCyclic', trigger: 'TimingEvent (100ms Periodic)', prio: 10 }
                  ]
                }
              ],
              rte: {
                desc: 'RTE diagnostic interface delivering MIL status and fault codes across the VFB.',
                apis: [
                  'Std_ReturnType Rte_Write_ppDiagnosticStatus_CheckEngineLight(boolean active)',
                  'Std_ReturnType Rte_Write_ppDiagnosticStatus_Odometer(uint32 odo)'
                ]
              },
              bsw: {
                services: [
                  { id: 'DCM', name: 'Diagnostic Com (Dcm)', cat: 'Diagnostics', desc: 'Implements ISO 14229 UDS services: Session 0x10, ReadDTC 0x19, ClearDTC 0x14, SecurityAccess 0x27.', apis: ['Dcm_MainFunction()'] },
                  { id: 'DEM', name: 'Diagnostic Event (Dem)', cat: 'Diagnostics', desc: 'DTC memory storage, freeze-frame captures, aging counters, and debouncing algorithms.', apis: ['Dem_SetEventStatus()'] },
                  { id: 'COM', name: 'AUTOSAR COM', cat: 'Communication', desc: 'Transmits diagnostic broadcast frame 0x300 at 100ms interval.', apis: ['Com_SendSignal()'] }
                ],
                abstraction: [
                  { id: 'CANTP', name: 'CAN Transport (CanTp)', cat: 'ECU Abstraction', desc: 'ISO 15765-2 multi-frame segmentation for large diagnostic payloads.', apis: ['CanTp_Transmit()'] },
                  { id: 'CANIF', name: 'CAN Interface (CanIf)', cat: 'ECU Abstraction', desc: 'CAN controller abstraction.', apis: ['CanIf_Transmit()'] }
                ],
                mcal: [
                  { id: 'CANDRV', name: 'Renesas RSCAN Driver', cat: 'MCAL', desc: 'Hardware CAN driver managing RSCAN FIFO channels.', apis: ['Can_Write()'] }
                ]
              }
            }
          },
          {
            id: 'ECU_DASHBOARD',
            name: 'ECU_DASHBOARD (Digital Instrument Cluster)',
            type: 'INSTRUMENTATION GATEWAY',
            icon: '🚀',
            canIdHex: '0x400 / RX Hub',
            canIdDec: 1024,
            cycleTime: 'Event-Driven (60 Hz)',
            dlc: 'Multi-Packet',
            payloadType: 'Decoded Physical Telemetry',
            status: 'ONLINE',
            pinout: 'Dual CAN Gateway, LVDS Display SerDes, Ethernet 100Base-T1',
            signals: ['EngineSpeed', 'VehicleSpeed', 'Gear', 'Odometer', 'BatterySOC', 'HeadlightsActive'],
            description: 'Receives and visualizes vehicle telemetry for the driver instrument cluster, HUD displays, signal oscilloscope, and CAN frame stream inspector.',
            autosar: {
              platform: 'AUTOSAR Classic Platform (CP) + Adaptive',
              release: 'Release 4.4.0 (R20-11)',
              safetyRating: 'ISO 26262 ASIL-B',
              targetSilicon: {
                mcu: 'NXP i.MX 8QuadMax (Dual Cortex-A53 + Dual Cortex-M4F Real-Time)',
                cores: 'Quad ARM Cortex-A53 (HMI) + Dual Cortex-M4 (Safety CAN Hub)',
                flash: '32 GB eMMC 5.1 Storage',
                ram: '4 GB LPDDR4 Memory',
                transceiver: 'Dual NXP TJA1044 CAN Transceiver + Broadcom BCM89811 Ethernet PHY'
              },
              swcs: [
                {
                  name: 'ClusterHMI_SWC',
                  type: 'HMI Application Software Component',
                  desc: 'Renders 60 FPS tachometer needle animations, speed arcs, telltales, and active drive mode HUDs.',
                  ports: [
                    { name: 'rpClusterTelemetry', type: 'R-PORT (Required)', iface: 'SR_VehicleCluster_IF', signals: ['EngineSpeed', 'VehicleSpeed', 'Gear', 'Odometer'] }
                  ],
                  runnables: [
                    { name: 'Runnable_16ms_RenderFrame', trigger: 'TimingEvent (16.6ms / 60 Hz)', prio: 30 }
                  ]
                }
              ],
              rte: {
                desc: 'RTE delivers decoded CAN signals from BSW COM to Cluster graphics renderer pipeline.',
                apis: [
                  'Std_ReturnType Rte_Read_rpClusterTelemetry_EngineSpeed(uint16* rpm)',
                  'Std_ReturnType Rte_Read_rpClusterTelemetry_VehicleSpeed(uint16* speed)'
                ]
              },
              bsw: {
                services: [
                  { id: 'COM', name: 'AUTOSAR COM', cat: 'Communication', desc: 'Unpacks incoming 0x100, 0x200, and 0x300 I-PDUs and updates RTE buffers.', apis: ['Com_ReceiveSignal()'] },
                  { id: 'PDUR', name: 'PDU Router (PduR)', cat: 'Communication', desc: 'Routes incoming CAN frames to COM stack.', apis: ['PduR_CanIfRxIndication()'] }
                ],
                abstraction: [
                  { id: 'CANIF', name: 'CAN Interface (CanIf)', cat: 'ECU Abstraction', desc: 'High-speed CAN interface controller.', apis: ['CanIf_RxIndication()'] }
                ],
                mcal: [
                  { id: 'CANDRV', name: 'FlexCAN Driver', cat: 'MCAL', desc: 'CAN peripheral driver on Cortex-M4 safety core.', apis: ['Can_MainFunction_Read()'] }
                ]
              }
            }
          }
        ]
      },

      domain: {
        name: 'Domain-Controller E/E Architecture',
        badge: '● DOMAIN CONTROLLER (CAN-FD & ETHERNET 100Base-T1)',
        proto: 'ISO 11898-1 CAN-FD & 100Base-T1',
        baud: '2.0 Mbps / 100 Mbps',
        term: '120 Ω Active Termination',
        busLoad: '36.8%',
        nodes: [
          {
            id: 'PT_DOMAIN',
            name: 'PT_DOMAIN (Powertrain Domain Controller)',
            type: 'DOMAIN CONTROLLER',
            icon: '⚡',
            canIdHex: '0x100 / CAN-FD',
            canIdDec: 256,
            cycleTime: '5 ms (200 Hz)',
            dlc: '64 Bytes (CAN-FD)',
            payloadType: 'CAN-FD High-Bandwidth Frame',
            status: 'ONLINE',
            pinout: 'CAN-FD Isolated Channel 1, Ethernet PHY 100Base-T1',
            signals: ['EngineSpeed', 'VehicleSpeed', 'ThrottlePosition', 'EngineTemp', 'OilPressure'],
            description: 'Domain controller orchestrating torque vectoring, engine management, transmission control, and thermal loop cooling.',
            autosar: {
              platform: 'AUTOSAR Classic Platform Release 4.4.0',
              safetyRating: 'ISO 26262 ASIL-D',
              targetSilicon: {
                mcu: 'Infineon AURIX™ TC399 (6 TriCore CPUs @ 300 MHz)',
                cores: '6 TriCore Cores',
                flash: '16 MB Flash',
                ram: '6.9 MB SRAM',
                transceiver: 'NXP TJA1443 CAN-FD Transceiver (5 Mbps capable)'
              },
              swcs: [
                {
                  name: 'PowertrainDomain_SWC',
                  type: 'Domain Application Component',
                  desc: 'High-frequency torque arbitration and transmission slip governance.',
                  ports: [
                    { name: 'ppPtState', type: 'P-PORT (Provided)', iface: 'SR_Powertrain_IF', signals: ['EngineSpeed', 'VehicleSpeed', 'ThrottlePosition'] }
                  ],
                  runnables: [{ name: 'Runnable_5ms_TorqueArbitration', trigger: 'TimingEvent (5ms)', prio: 25 }]
                }
              ],
              rte: { desc: 'High-speed CAN-FD RTE buffer router.', apis: ['Rte_Write_ppPtState_EngineSpeed()'] },
              bsw: {
                services: [
                  { id: 'COM', name: 'AUTOSAR COM (CAN-FD)', cat: 'Communication', desc: 'Handles 64-byte CAN-FD I-PDUs.', apis: ['Com_SendSignal()'] },
                  { id: 'PDUR', name: 'PduR', cat: 'Communication', desc: 'CAN-FD routing.', apis: ['PduR_Transmit()'] }
                ],
                abstraction: [{ id: 'CANIF', name: 'CanIf CAN-FD', cat: 'ECU Abstraction', desc: 'CAN-FD frame filtering.', apis: ['CanIf_Transmit()'] }],
                mcal: [{ id: 'CANDRV', name: 'CAN-FD Driver', cat: 'MCAL', desc: 'Hardware CAN-FD controller with Bit Rate Switching (BRS).', apis: ['Can_Write()'] }]
              }
            }
          },
          {
            id: 'BODY_DOMAIN',
            name: 'BODY_DOMAIN (Body & Comfort Domain)',
            type: 'DOMAIN CONTROLLER',
            icon: '💡',
            canIdHex: '0x200 / CAN-FD',
            canIdDec: 512,
            cycleTime: '10 ms (100 Hz)',
            dlc: '64 Bytes (CAN-FD)',
            payloadType: 'CAN-FD Frame',
            status: 'ONLINE',
            pinout: 'CAN-FD Channel 2, LIN Gateway Master 1-4',
            signals: ['FuelLevel', 'BatterySOC', 'Gear', 'BrakeActive', 'TurnSignal', 'SteeringAngle', 'HeadlightsActive'],
            description: 'Centralizes chassis, exterior matrix headlights, cabin climate conditioning, and steering wheel sensor loops.',
            autosar: {
              platform: 'AUTOSAR Classic Platform Release 4.4.0',
              safetyRating: 'ISO 26262 ASIL-B',
              targetSilicon: {
                mcu: 'NXP S32G274A Vehicle Network Processor (Quad Cortex-A53 + Tri Cortex-M7)',
                cores: '4x A53 + 3x M7 Dual-Core Lockstep',
                flash: '64 MB QSPI Flash',
                ram: '4 GB DDR4',
                transceiver: 'TJA1463 CAN Signal Improvement (SIC) Transceiver'
              },
              swcs: [{ name: 'BodyDomain_SWC', type: 'Body SWC', desc: 'Cabin and exterior lighting manager.', ports: [], runnables: [] }],
              rte: { desc: 'Body domain RTE bus.', apis: [] },
              bsw: { services: [{ id: 'COM', name: 'COM', cat: 'Communication', desc: 'Body COM stack.', apis: [] }], abstraction: [], mcal: [] }
            }
          },
          {
            id: 'CHASSIS_DOMAIN',
            name: 'CHASSIS_DOMAIN (Chassis & Safety Domain)',
            type: 'DOMAIN CONTROLLER',
            icon: '🛡️',
            canIdHex: '0x300 / CAN-FD',
            canIdDec: 768,
            cycleTime: '5 ms (200 Hz)',
            dlc: '64 Bytes',
            payloadType: 'Safety Critical Stream',
            status: 'ONLINE',
            pinout: 'CAN-FD Channel 3, FlexRay Channel A, Dual ASIL-D Power Rail',
            signals: ['CheckEngineLight', 'BatteryWarning', 'TirePressureWarning', 'ABSWarning', 'Odometer'],
            description: 'Oversees brake-by-wire hydraulic modulation, electronic stability control (ESC), and ABS pulse modulation.',
            autosar: {
              platform: 'AUTOSAR Classic Platform Release 4.4.0',
              safetyRating: 'ISO 26262 ASIL-D',
              targetSilicon: {
                mcu: 'STMicroelectronics Stellar P6 (Dual Arm Cortex-R52+ @ 400 MHz)',
                cores: 'Dual Lockstep Cortex-R52+',
                flash: '8 MB Flash',
                ram: '1.2 MB RAM',
                transceiver: 'ST L9663 High-Speed CAN-FD'
              },
              swcs: [{ name: 'SafetyChassis_SWC', type: 'ASIL-D SWC', desc: 'ESC and ABS control.', ports: [], runnables: [] }],
              rte: { desc: 'Chassis safety RTE.', apis: [] },
              bsw: { services: [{ id: 'COM', name: 'COM', cat: 'Communication', desc: 'Chassis COM.', apis: [] }], abstraction: [], mcal: [] }
            }
          },
          {
            id: 'CENTRAL_GW',
            name: 'CENTRAL_GW (Automotive Ethernet Backbone)',
            type: 'CENTRAL ROUTING GATEWAY',
            icon: '🌐',
            canIdHex: 'GW-Router',
            canIdDec: 0,
            cycleTime: 'Real-Time Routing',
            dlc: 'Gigabit Packets',
            payloadType: 'IEEE 802.3 Ethernet & CAN-FD',
            status: 'ONLINE',
            pinout: '8x 100/1000Base-T1 Ethernet, 6x CAN-FD, 4x LIN, PCIe',
            signals: ['EngineSpeed', 'VehicleSpeed', 'Gear', 'SteeringAngle'],
            description: 'Ultra-low latency automotive gateway interconnecting domain controllers with Ethernet TSN time-sensitive networking.',
            autosar: {
              platform: 'AUTOSAR Classic + Adaptive Gateway',
              safetyRating: 'ISO 26262 ASIL-D',
              targetSilicon: {
                mcu: 'NXP S32G399A High-Performance Gateway (8x Cortex-A53 + 4x Cortex-M7)',
                cores: '8x A53 + 4x M7 Lockstep',
                flash: '128 MB NOR Flash',
                ram: '8 GB LPDDR4',
                transceiver: 'Multi-port Gigabit Ethernet PHY & TJA1443 CAN-FD'
              },
              swcs: [{ name: 'GatewayRouting_SWC', type: 'Gateway SWC', desc: 'Ethernet-CAN routing.', ports: [], runnables: [] }],
              rte: { desc: 'VFB Gateway router.', apis: [] },
              bsw: { services: [{ id: 'COM', name: 'COM', cat: 'Communication', desc: 'Central COM router.', apis: [] }], abstraction: [], mcal: [] }
            }
          }
        ]
      },

      zonal: {
        name: 'Zonal Software-Defined Vehicle (AUTOSAR Adaptive & Classic)',
        badge: '● ZONAL SDV ARCHITECTURE (AUTOSAR ADAPTIVE & CLASSIC)',
        proto: 'AUTOSAR Adaptive Platform R22-11 & IEEE 802.1 TSN Ethernet',
        baud: '10 Gbps Ethernet / CAN-XL (10 Mbps)',
        term: 'High-Density Active Termination',
        busLoad: '42.1%',
        nodes: [
          {
            id: 'HPC_CENTRAL',
            name: 'HPC_CENTRAL (Central Compute Brain)',
            type: 'HIGH-PERFORMANCE VEHICLE COMPUTER',
            icon: '🧠',
            canIdHex: 'HPC-Central (vcan0)',
            canIdDec: 0,
            cycleTime: '5 ms (200 Hz)',
            dlc: 'Ethernet Frame',
            payloadType: 'TSN Time-Sensitive Telemetry',
            status: 'ONLINE',
            pinout: 'PCIe Gen4, Multi-Gigabit Ethernet SerDes, Dual ASIL-D Lockstep Cores',
            signals: ['EngineSpeed', 'VehicleSpeed', 'ThrottlePosition', 'SteeringAngle', 'BatterySOC'],
            description: 'Central autonomous brain executing real-time digital twin physics, trajectory planning, powertrain energy orchestration, and neural inference.',
            autosar: {
              platform: 'AUTOSAR Adaptive Platform (AP)',
              release: 'Release R22-11 (ara::com / ara::exec / ara::diag)',
              safetyRating: 'ISO 26262 ASIL-D Mixed-Criticality',
              targetSilicon: {
                mcu: 'NVIDIA DRIVE Orin™ / Qualcomm Snapdragon Digital Chassis (275 TOPS)',
                cores: '12x Arm Cortex-A78AE + NVIDIA Ampere GPU (2048 Tensor Cores)',
                flash: '256 GB UFS 3.1 NVMe',
                ram: '32 GB LPDDR5 (204 GB/s Bandwidth)',
                transceiver: 'Marvell 88Q2112 1000Base-T1 Automotive Ethernet'
              },
              swcs: [
                {
                  name: 'DigitalTwinExecution_App',
                  type: 'Adaptive Application (ara::exec)',
                  desc: 'Runs full 60 FPS vehicle physics model, vehicle dynamics solver, and CAN-to-Ethernet serialization.',
                  ports: [
                    { name: 'VehicleStateService', type: 'ara::com Service Provider', iface: 'Service::VehicleDynamics', signals: ['EngineSpeed', 'VehicleSpeed', 'ThrottlePosition'] }
                  ],
                  runnables: [{ name: 'StepPhysicsModel()', trigger: 'Event-Driven (60 Hz)', prio: 50 }]
                }
              ],
              rte: { desc: 'AUTOSAR Runtime for Adaptive Applications (ARA). SOME/IP & DDS serialization.', apis: ['ara::com::InstanceSpecifier', 'ara::exec::ExecutionClient'] },
              bsw: {
                services: [
                  { id: 'ARA_COM', name: 'ara::com (Service Com)', cat: 'Adaptive BSW', desc: 'Service-oriented communication over SOME/IP and DDS.', apis: ['FindService()', 'Subscribe()'] },
                  { id: 'ARA_EXEC', name: 'ara::exec (Execution Mgmt)', cat: 'Adaptive BSW', desc: 'POSIX process management, cgroups CPU isolation, and deterministic startup sequencing.', apis: ['ReportExecutionState()'] },
                  { id: 'ARA_DIAG', name: 'ara::diag (DoIP Diagnostics)', cat: 'Adaptive BSW', desc: 'Diagnostic Communication over IP (ISO 13400 DoIP).', apis: ['SetResponse()'] },
                  { id: 'ARA_PER', name: 'ara::per (Persistency)', cat: 'Adaptive BSW', desc: 'Secure Key-Value storage and file access with hardware AES-XTS.', apis: ['OpenKeyValueStorage()'] }
                ],
                abstraction: [{ id: 'ETHIF', name: 'Ethernet Interface (EthIf)', cat: 'Abstraction', desc: 'Network abstraction for 10GbE MAC controller.', apis: ['EthIf_Transmit()'] }],
                mcal: [{ id: 'ETHDRV', name: 'Ethernet Driver', cat: 'MCAL', desc: 'DMA packet ring buffers for automotive Ethernet.', apis: ['Eth_Write()'] }]
              }
            }
          },
          {
            id: 'ZONAL_FL',
            name: 'ZONAL_FL (Front-Left Zonal Gateway)',
            type: 'ZONAL MICRO-GATEWAY',
            icon: '📍',
            canIdHex: '0x110 (Subnet A)',
            canIdDec: 272,
            cycleTime: '10 ms (100 Hz)',
            dlc: '8/16 Bytes (CAN-FD)',
            payloadType: 'Zonal Sensor Stream',
            status: 'ONLINE',
            pinout: 'Ethernet Drop, Front-Left Sensor Hub, Steer Actuator Port',
            signals: ['SteeringAngle', 'HeadlightsActive', 'EngineTemp'],
            description: 'Localizes sensor aggregation and actuator drivers for the front-left quadrant: left projector headlight, front steering angle, and wheel sensor.',
            autosar: {
              platform: 'AUTOSAR Classic Platform (CP) Zonal Node',
              safetyRating: 'ISO 26262 ASIL-D',
              targetSilicon: {
                mcu: 'Infineon AURIX™ TC367DP (Dual TriCore @ 300 MHz)',
                cores: 'Dual Core Lockstep',
                flash: '4 MB Flash',
                ram: '590 KB SRAM',
                transceiver: 'TJA1044 CAN + Broadcom 100Base-T1 PHY'
              },
              swcs: [{ name: 'ZonalFL_SWC', type: 'Zonal IO Component', desc: 'Left headlamp and steering angle sensor bridge.', ports: [], runnables: [] }],
              rte: { desc: 'Zonal RTE bridge.', apis: [] },
              bsw: { services: [{ id: 'COM', name: 'COM', cat: 'Communication', desc: 'Zonal packet gateway.', apis: [] }], abstraction: [], mcal: [] }
            }
          },
          {
            id: 'ZONAL_FR',
            name: 'ZONAL_FR (Front-Right Zonal Gateway)',
            type: 'ZONAL MICRO-GATEWAY',
            icon: '📍',
            canIdHex: '0x120 (Subnet B)',
            canIdDec: 288,
            cycleTime: '10 ms (100 Hz)',
            dlc: '8/16 Bytes (CAN-FD)',
            payloadType: 'Zonal Sensor Stream',
            status: 'ONLINE',
            pinout: 'Ethernet Drop, Front-Right Sensor Hub, Thermal Loop Controller',
            signals: ['EngineSpeed', 'ThrottlePosition', 'OilPressure'],
            description: 'Handles the front-right vehicle quadrant: right projector headlight, powertrain sensors, cooling fan governors, and front-right wheel telemetry.',
            autosar: {
              platform: 'AUTOSAR Classic Platform (CP)',
              safetyRating: 'ISO 26262 ASIL-B',
              targetSilicon: {
                mcu: 'Infineon AURIX™ TC367DP (Dual TriCore @ 300 MHz)',
                cores: 'Dual Core Lockstep',
                flash: '4 MB Flash',
                ram: '590 KB SRAM',
                transceiver: 'TJA1044 CAN Transceiver'
              },
              swcs: [{ name: 'ZonalFR_SWC', type: 'Zonal IO Component', desc: 'Front-right thermal & powertrain sensor hub.', ports: [], runnables: [] }],
              rte: { desc: 'Zonal RTE bridge.', apis: [] },
              bsw: { services: [{ id: 'COM', name: 'COM', cat: 'Communication', desc: 'Zonal packet gateway.', apis: [] }], abstraction: [], mcal: [] }
            }
          },
          {
            id: 'ZONAL_REAR',
            name: 'ZONAL_REAR (Rear Zonal Gateway)',
            type: 'ZONAL MICRO-GATEWAY',
            icon: '📍',
            canIdHex: '0x130 (Subnet C)',
            canIdDec: 304,
            cycleTime: '10 ms (100 Hz)',
            dlc: '8/16 Bytes (CAN-FD)',
            payloadType: 'Zonal Sensor Stream',
            status: 'ONLINE',
            pinout: 'Ethernet Drop, Rear Brake Actuator, Fuel/Charge Port Driver',
            signals: ['VehicleSpeed', 'BrakeActive', 'FuelLevel', 'Odometer'],
            description: 'Aggregates rear powertrain differential sensors, LED taillight cyber bar, brake calipers, fuel gauge sender, and backup cameras.',
            autosar: {
              platform: 'AUTOSAR Classic Platform (CP)',
              safetyRating: 'ISO 26262 ASIL-D',
              targetSilicon: {
                mcu: 'NXP S32K312 (Arm Cortex-M7 @ 120 MHz)',
                cores: 'Single Core Lockstep',
                flash: '2 MB Flash',
                ram: '256 KB SRAM',
                transceiver: 'NXP TJA1051 CAN Transceiver'
              },
              swcs: [{ name: 'ZonalRear_SWC', type: 'Zonal Rear SWC', desc: 'Rear brake and taillight driver.', ports: [], runnables: [] }],
              rte: { desc: 'Zonal Rear RTE.', apis: [] },
              bsw: { services: [{ id: 'COM', name: 'COM', cat: 'Communication', desc: 'Rear COM stack.', apis: [] }], abstraction: [], mcal: [] }
            }
          }
        ]
      },

      ev: {
        name: 'Electric Vehicle High-Voltage Topology',
        badge: '● EV HIGH-VOLTAGE ARCHITECTURE (800V HV / AUTOSAR CP)',
        proto: 'ISO 15118 & CAN-FD (1.0 Mbps)',
        baud: '1.0 Mbps High-Speed CAN',
        term: '120 Ω High-Voltage Galvanically Isolated',
        busLoad: '31.5%',
        nodes: [
          {
            id: 'VCU_MASTER',
            name: 'VCU_MASTER (Vehicle Control Unit)',
            type: 'EV POWERTRAIN SUPERVISOR',
            icon: '⚡',
            canIdHex: '0x100 (Drive Demand)',
            canIdDec: 256,
            cycleTime: '10 ms (100 Hz)',
            dlc: '8 Bytes',
            payloadType: 'EV Drive Demand Stream',
            status: 'ONLINE',
            pinout: 'CAN-FD Isolated Channel 1, High-Voltage Interlock Loop (HVIL)',
            signals: ['EngineSpeed', 'VehicleSpeed', 'ThrottlePosition', 'EngineTemp', 'OilPressure'],
            description: 'Top-level EV supervisor calculating pedal torque map, regenerative braking blending, traction limiters, and HV safety interlocks.',
            autosar: {
              platform: 'AUTOSAR Classic Platform Release 4.4.0',
              safetyRating: 'ISO 26262 ASIL-D',
              targetSilicon: {
                mcu: 'Infineon AURIX™ TC387QP (Quad 32-bit TriCore @ 300 MHz)',
                cores: '4 Cores (2 Lockstep)',
                flash: '10 MB Flash',
                ram: '3 MB SRAM',
                transceiver: 'TJA1044GT Galvanically Isolated Transceiver'
              },
              swcs: [
                {
                  name: 'EvTorqueArbitration_SWC',
                  type: 'Powertrain Application Component',
                  desc: 'Regenerative braking blending and dual-motor torque vectoring.',
                  ports: [{ name: 'ppMotorDemand', type: 'P-PORT (Provided)', iface: 'SR_TorqueDemand_IF', signals: ['EngineSpeed', 'ThrottlePosition'] }],
                  runnables: [{ name: 'Runnable_10ms_TorqueCalc', trigger: 'TimingEvent (10ms)', prio: 20 }]
                }
              ],
              rte: { desc: 'EV Supervisor RTE.', apis: ['Rte_Write_ppMotorDemand_EngineSpeed()'] },
              bsw: {
                services: [
                  { id: 'COM', name: 'AUTOSAR COM', cat: 'Communication', desc: 'VCU CAN frame packaging.', apis: ['Com_SendSignal()'] },
                  { id: 'WDGM', name: 'Watchdog Manager', cat: 'System', desc: 'Monitors torque runnable execution deadline.', apis: ['WdgM_CheckpointReached()'] }
                ],
                abstraction: [{ id: 'CANIF', name: 'CanIf', cat: 'ECU Abstraction', desc: 'CAN Interface.', apis: ['CanIf_Transmit()'] }],
                mcal: [{ id: 'CANDRV', name: 'CanDrv', cat: 'MCAL', desc: 'TriCore MultiCAN+ driver.', apis: ['Can_Write()'] }]
              }
            }
          },
          {
            id: 'BMS_800V',
            name: 'BMS_800V (Battery Management System)',
            type: 'HIGH-VOLTAGE ENERGY CONTROLLER',
            icon: '🔋',
            canIdHex: '0x200 (Battery Pack)',
            canIdDec: 512,
            cycleTime: '20 ms (50 Hz)',
            dlc: '8 Bytes',
            payloadType: 'HV Battery Telemetry Stream',
            status: 'ONLINE',
            pinout: 'Isolated CAN-FD Channel 2, Pyro-Fuse Driver, 96-Cell CSC Bus',
            signals: ['BatterySOC', 'FuelLevel', 'BrakeActive', 'SteeringAngle', 'HeadlightsActive'],
            description: 'Monitors 800V silicon-carbide battery pack: state-of-charge (SOC 98%), state-of-health, cell voltage balance, isolation resistance, and contactors.',
            autosar: {
              platform: 'AUTOSAR Classic Platform Release 4.4.0',
              safetyRating: 'ISO 26262 ASIL-D',
              targetSilicon: {
                mcu: 'NXP S32K344 (Dual Cortex-M7 @ 160 MHz)',
                cores: 'Dual Core Lockstep',
                flash: '4 MB Flash',
                ram: '512 KB SRAM',
                transceiver: 'Analog Devices Isolated CAN Transceiver (5 kV Isolation)'
              },
              swcs: [{ name: 'BmsStateOfCharge_SWC', type: 'Battery SWC', desc: 'Kalman filter SOC estimation.', ports: [], runnables: [] }],
              rte: { desc: 'BMS RTE signal bus.', apis: [] },
              bsw: { services: [{ id: 'COM', name: 'COM', cat: 'Communication', desc: 'BMS telemetry broadcast.', apis: [] }], abstraction: [], mcal: [] }
            }
          },
          {
            id: 'INVERTER_FRONT',
            name: 'INVERTER_FRONT (Front SiC Inverter & Motor)',
            type: 'TRACTION INVERTER CONTROLLER',
            icon: '⚡',
            canIdHex: '0x110 (Inverter F)',
            canIdDec: 272,
            cycleTime: '1 ms (1000 Hz)',
            dlc: '8 Bytes',
            payloadType: 'Field-Oriented Control (FOC) Telemetry',
            status: 'ONLINE',
            pinout: 'Dedicated Inverter CAN Drop, Resolver Sensor Angle Port, HV Gate Drivers',
            signals: ['EngineSpeed', 'VehicleSpeed', 'OilPressure'],
            description: '180 kW front silicon-carbide (SiC) traction inverter executing Space Vector PWM and Field-Oriented Control at 20 kHz carrier frequency.',
            autosar: {
              platform: 'AUTOSAR Classic Platform Release 4.4.0',
              safetyRating: 'ISO 26262 ASIL-D',
              targetSilicon: {
                mcu: 'Texas Instruments TMS320F28388D (Dual C28x DSP @ 200 MHz)',
                cores: 'Dual C28x DSP Cores + Arm Cortex-M4',
                flash: '1 MB Flash',
                ram: '512 KB SRAM',
                transceiver: 'ISO1042 Isolated CAN Transceiver'
              },
              swcs: [{ name: 'FocMotorControl_SWC', type: 'Inverter SWC', desc: 'Field-oriented current control loop.', ports: [], runnables: [] }],
              rte: { desc: 'Inverter real-time RTE.', apis: [] },
              bsw: { services: [{ id: 'COM', name: 'COM', cat: 'Communication', desc: 'Inverter com stack.', apis: [] }], abstraction: [], mcal: [] }
            }
          },
          {
            id: 'INVERTER_REAR',
            name: 'INVERTER_REAR (Rear SiC Inverter & Motor)',
            type: 'TRACTION INVERTER CONTROLLER',
            icon: '⚡',
            canIdHex: '0x120 (Inverter R)',
            canIdDec: 288,
            cycleTime: '1 ms (1000 Hz)',
            dlc: '8 Bytes',
            payloadType: 'Field-Oriented Control (FOC) Telemetry',
            status: 'ONLINE',
            pinout: 'Dedicated Inverter CAN Drop, Resolver Sensor Angle Port, HV Gate Drivers',
            signals: ['VehicleSpeed', 'Gear', 'Odometer'],
            description: '300 kW rear silicon-carbide (SiC) traction inverter executing high-torque launch control, e-differential vectoring, and active damping.',
            autosar: {
              platform: 'AUTOSAR Classic Platform Release 4.4.0',
              safetyRating: 'ISO 26262 ASIL-D',
              targetSilicon: {
                mcu: 'Texas Instruments TMS320F28388D (Dual C28x DSP @ 200 MHz)',
                cores: 'Dual C28x DSP Cores + Arm Cortex-M4',
                flash: '1 MB Flash',
                ram: '512 KB SRAM',
                transceiver: 'ISO1042 Isolated CAN Transceiver'
              },
              swcs: [{ name: 'RearInverter_SWC', type: 'Inverter SWC', desc: 'Rear traction torque control.', ports: [], runnables: [] }],
              rte: { desc: 'Rear Inverter RTE.', apis: [] },
              bsw: { services: [{ id: 'COM', name: 'COM', cat: 'Communication', desc: 'Rear inverter com stack.', apis: [] }], abstraction: [], mcal: [] }
            }
          }
        ]
      }
    };
  }

  initDOM() {
    this.dom = {
      // Top stats
      badge: document.getElementById('ecu-active-topology-badge'),
      proto: document.getElementById('topo-bus-proto'),
      baud: document.getElementById('topo-baud-rate'),
      activeCount: document.getElementById('topo-active-count'),
      busLoad: document.getElementById('topo-bus-load'),
      term: document.getElementById('topo-term-res'),

      // Containers
      schematic: document.getElementById('ecu-bus-schematic'),
      autosarContainer: document.getElementById('ecu-autosar-container'),
      arxmlContainer: document.getElementById('ecu-arxml-container'),
      topologyViewport: document.getElementById('ecu-topology-viewport'),

      // View switcher buttons
      btnViewAutosar: document.getElementById('btn-view-autosar'),
      btnViewTopology: document.getElementById('btn-view-topology'),
      btnViewArxml: document.getElementById('btn-view-arxml'),

      // Detail Panel
      detailPanel: document.getElementById('ecu-node-detail-panel'),
      detailType: document.getElementById('detail-node-type'),
      detailName: document.getElementById('detail-node-name'),
      detailId: document.getElementById('detail-node-id'),
      detailFrameId: document.getElementById('detail-frame-id'),
      detailCycle: document.getElementById('detail-cycle-time'),
      detailDlc: document.getElementById('detail-dlc'),
      detailPayload: document.getElementById('detail-payload-type'),
      detailSignalsList: document.getElementById('detail-signals-list'),
      btnToggleNode: document.getElementById('btn-toggle-node-state'),

      // Header actions
      btnPingAll: document.getElementById('btn-simulate-all-nodes'),
      btnReset: document.getElementById('btn-reset-ecu-defaults')
    };

    this.bindEvents();
    this.render();
  }

  bindEvents() {
    // Layout switcher buttons
    const layoutButtons = document.querySelectorAll('.ecu-layout-btn');
    layoutButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        layoutButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const layout = btn.getAttribute('data-layout');
        this.setLayout(layout);
      });
    });

    // View switcher buttons (AUTOSAR Layered vs Physical Topology vs ARXML)
    if (this.dom.btnViewAutosar) {
      this.dom.btnViewAutosar.addEventListener('click', () => this.setView('autosar'));
    }
    if (this.dom.btnViewTopology) {
      this.dom.btnViewTopology.addEventListener('click', () => this.setView('topology'));
    }
    if (this.dom.btnViewArxml) {
      this.dom.btnViewArxml.addEventListener('click', () => this.setView('arxml'));
    }

    if (this.dom.btnToggleNode) {
      this.dom.btnToggleNode.addEventListener('click', () => this.toggleSelectedNodeState());
    }

    if (this.dom.btnPingAll) {
      this.dom.btnPingAll.addEventListener('click', () => this.pingAllNodes());
    }

    if (this.dom.btnReset) {
      this.dom.btnReset.addEventListener('click', () => this.resetDefaults());
    }
  }

  setView(viewName) {
    this.activeView = viewName;
    const viewButtons = [this.dom.btnViewAutosar, this.dom.btnViewTopology, this.dom.btnViewArxml];
    viewButtons.forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    if (viewName === 'autosar' && this.dom.btnViewAutosar) this.dom.btnViewAutosar.classList.add('active');
    if (viewName === 'topology' && this.dom.btnViewTopology) this.dom.btnViewTopology.classList.add('active');
    if (viewName === 'arxml' && this.dom.btnViewArxml) this.dom.btnViewArxml.classList.add('active');

    this.renderViewContainers();
  }

  setLayout(layoutKey) {
    if (!this.topologies[layoutKey]) return;
    this.activeLayout = layoutKey;
    const currentNodes = this.topologies[layoutKey].nodes;
    this.selectedNodeId = currentNodes[0].id;
    this.render();
  }

  getCurrentTopology() {
    return this.topologies[this.activeLayout];
  }

  getSelectedNode() {
    const topo = this.getCurrentTopology();
    return topo.nodes.find(n => n.id === this.selectedNodeId) || topo.nodes[0];
  }

  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    this.renderSchematicSelection();
    this.renderNodeDetail();
    if (this.activeView === 'autosar') {
      this.renderAutosarArchitecture();
    } else if (this.activeView === 'arxml') {
      this.renderArxmlInspector();
    }
  }

  toggleSelectedNodeState() {
    const node = this.getSelectedNode();
    if (!node) return;
    node.status = (node.status === 'ONLINE') ? 'OFFLINE' : 'ONLINE';
    this.render();
  }

  pingAllNodes() {
    const topo = this.getCurrentTopology();
    topo.nodes.forEach(n => {
      n.status = 'ONLINE';
      this.packetCounters[n.id] = (this.packetCounters[n.id] || 0) + 15;
    });

    if (this.dom.schematic) {
      this.dom.schematic.classList.add('pulse-active');
      setTimeout(() => this.dom.schematic.classList.remove('pulse-active'), 800);
    }

    this.render();
  }

  resetDefaults() {
    for (const l in this.topologies) {
      this.topologies[l].nodes.forEach(n => {
        n.status = 'ONLINE';
      });
    }
    this.render();
  }

  updateTelemetry(data) {
    this.latestTelemetry = data;
    const topo = this.getCurrentTopology();

    topo.nodes.forEach(node => {
      if (node.status === 'ONLINE') {
        this.packetCounters[node.id] = (this.packetCounters[node.id] || 0) + 1;
      }
    });

    this.renderNodeTelemetry();
    this.renderAutosarLiveTelemetry();
  }

  render() {
    const topo = this.getCurrentTopology();

    if (this.dom.badge) this.dom.badge.textContent = topo.badge;
    if (this.dom.proto) this.dom.proto.textContent = topo.proto;
    if (this.dom.baud) this.dom.baud.textContent = topo.baud;
    if (this.dom.term) this.dom.term.textContent = topo.term;
    if (this.dom.busLoad) this.dom.busLoad.textContent = topo.busLoad;

    const onlineCount = topo.nodes.filter(n => n.status === 'ONLINE').length;
    if (this.dom.activeCount) {
      this.dom.activeCount.textContent = `${onlineCount} / ${topo.nodes.length} ONLINE`;
      this.dom.activeCount.className = `value ${onlineCount === topo.nodes.length ? 'green' : 'amber'}`;
    }

    this.renderSchematic();
    this.renderNodeDetail();
    this.renderViewContainers();
  }

  renderViewContainers() {
    const isAutosar = (this.activeView === 'autosar');
    const isTopology = (this.activeView === 'topology');
    const isArxml = (this.activeView === 'arxml');

    if (this.dom.schematic) {
      this.dom.schematic.style.display = isTopology ? 'block' : 'none';
    }
    if (this.dom.autosarContainer) {
      this.dom.autosarContainer.style.display = isAutosar ? 'block' : 'none';
      if (isAutosar) this.renderAutosarArchitecture();
    }
    if (this.dom.arxmlContainer) {
      this.dom.arxmlContainer.style.display = isArxml ? 'block' : 'none';
      if (isArxml) this.renderArxmlInspector();
    }
  }

  renderSchematic() {
    if (!this.dom.schematic) return;
    const topo = this.getCurrentTopology();

    let html = `
      <!-- CAN Bus Physical Backbone Wire Line -->
      <div class="can-bus-spine">
        <div class="bus-terminator left"><span class="term-tag">120 Ω</span></div>
        <div class="bus-wires">
          <div class="wire wire-can-h"><span class="wire-label">CAN_H (3.5V DOMINANT / 2.5V RECESSIVE)</span></div>
          <div class="wire wire-can-l"><span class="wire-label">CAN_L (1.5V DOMINANT / 2.5V RECESSIVE)</span></div>
        </div>
        <div class="bus-terminator right"><span class="term-tag">120 Ω</span></div>
      </div>

      <!-- Node Drop Boxes Grid -->
      <div class="ecu-nodes-row">
    `;

    topo.nodes.forEach(node => {
      const isSelected = (node.id === this.selectedNodeId);
      const isOnline = (node.status === 'ONLINE');
      const pktCount = this.packetCounters[node.id] || 0;

      html += `
        <div class="ecu-node-card ${isSelected ? 'selected' : ''} ${isOnline ? 'online' : 'offline'}" data-node-id="${node.id}">
          <div class="node-drop-line ${isOnline ? 'active' : ''}"></div>
          
          <div class="node-card-top">
            <span class="node-icon">${node.icon}</span>
            <div class="node-title-group">
              <span class="node-name">${node.id}</span>
              <span class="node-id-hex">${node.canIdHex}</span>
            </div>
            <span class="node-status-pill ${isOnline ? 'online' : 'offline'}">${node.status}</span>
          </div>

          <div class="node-card-body">
            <div class="node-meta-item">
              <span class="lbl">TYPE:</span>
              <span class="val">${node.type}</span>
            </div>
            <div class="node-meta-item">
              <span class="lbl">ARCH:</span>
              <span class="val violet">${node.autosar ? (node.autosar.safetyRating || 'AUTOSAR CP') : 'AUTOSAR'}</span>
            </div>
            <div class="node-meta-item">
              <span class="lbl">CYCLE:</span>
              <span class="val cyan">${node.cycleTime}</span>
            </div>
            <div class="node-meta-item">
              <span class="lbl">PACKETS:</span>
              <span class="val mono green" id="pkt-${node.id}">${pktCount} frames</span>
            </div>
          </div>

          <div class="node-card-footer" id="live-card-signals-${node.id}">
            <!-- Live mini signal chips -->
          </div>
        </div>
      `;
    });

    html += `</div>`;
    this.dom.schematic.innerHTML = html;

    const cards = this.dom.schematic.querySelectorAll('.ecu-node-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const nodeId = card.getAttribute('data-node-id');
        this.selectNode(nodeId);
      });
    });

    this.renderNodeTelemetry();
  }

  renderSchematicSelection() {
    if (!this.dom.schematic) return;
    const cards = this.dom.schematic.querySelectorAll('.ecu-node-card');
    cards.forEach(card => {
      const id = card.getAttribute('data-node-id');
      if (id === this.selectedNodeId) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  // ================= OFFICIAL AUTOSAR LAYERED VIEW RENDERER =================
  renderAutosarArchitecture() {
    if (!this.dom.autosarContainer) return;
    const node = this.getSelectedNode();
    if (!node || !node.autosar) {
      this.dom.autosarContainer.innerHTML = `<div class="autosar-empty">No AUTOSAR model defined for ${node.id}</div>`;
      return;
    }

    const auto = node.autosar;
    const sil = auto.targetSilicon || {};

    let html = `
      <div class="autosar-stack-wrapper">
        <!-- AUTOSAR Meta Banner -->
        <div class="autosar-meta-banner">
          <div class="autosar-badge-group">
            <span class="autosar-logo-tag">AUTOSAR</span>
            <span class="autosar-platform-badge">${auto.platform}</span>
            <span class="autosar-spec-badge">${auto.release || 'Release 4.4.0 (R20-11)'}</span>
            <span class="autosar-asil-badge">${auto.safetyRating || 'ISO 26262 ASIL-D'}</span>
          </div>
          <div class="autosar-silicon-info">
            <span class="sil-icon">🖲️</span>
            <span class="sil-chip"><strong>MCU:</strong> ${sil.mcu || 'Infineon AURIX™ TC397'}</span>
            <span class="sil-chip"><strong>CORES:</strong> ${sil.cores || 'Triple Lockstep'}</span>
            <span class="sil-chip"><strong>TRANSCEIVER:</strong> ${sil.transceiver || 'NXP TJA1044'}</span>
          </div>
        </div>

        <!-- Real-Time Signal & PDU Flow Sequence Trace -->
        <div class="autosar-pdu-trace-banner">
          <div class="trace-title">
            <span class="pulse-dot"></span>
            <strong>AUTOSAR REAL-TIME PDU &amp; SIGNAL FLOW TRACE</strong>
            <span class="trace-sub">[CAN Controller Mailbox ➜ MCAL CanDrv ➜ CanIf ➜ PduR ➜ COM ➜ RTE ➜ Application SWC]</span>
          </div>
          <div class="trace-steps-row">
            <div class="trace-step">
              <span class="step-num">1</span>
              <div class="step-box">
                <span class="step-lbl">PHYSICAL BUS</span>
                <span class="step-val">CAN_H / CAN_L</span>
                <span class="step-sub">500 kbps (120Ω)</span>
              </div>
            </div>
            <span class="trace-arrow">➜</span>
            <div class="trace-step">
              <span class="step-num">2</span>
              <div class="step-box orange">
                <span class="step-lbl">MCAL CanDrv</span>
                <span class="step-val">Can_MainFunction_Read()</span>
                <span class="step-sub">Hardware FIFO MB #0</span>
              </div>
            </div>
            <span class="trace-arrow">➜</span>
            <div class="trace-step">
              <span class="step-num">3</span>
              <div class="step-box amber">
                <span class="step-lbl">ECU ABSTRACTION</span>
                <span class="step-val">CanIf_RxIndication()</span>
                <span class="step-sub">HRH 0x100 Filter Match</span>
              </div>
            </div>
            <span class="trace-arrow">➜</span>
            <div class="trace-step">
              <span class="step-num">4</span>
              <div class="step-box emerald">
                <span class="step-lbl">SERVICES PduR</span>
                <span class="step-val">PduR_CanIfRxIndication()</span>
                <span class="step-sub">Direct Routing to COM</span>
              </div>
            </div>
            <span class="trace-arrow">➜</span>
            <div class="trace-step">
              <span class="step-num">5</span>
              <div class="step-box emerald">
                <span class="step-lbl">SERVICES COM</span>
                <span class="step-val">Com_RxIndication()</span>
                <span class="step-sub">Signal Unpack &amp; Filter</span>
              </div>
            </div>
            <span class="trace-arrow">➜</span>
            <div class="trace-step">
              <span class="step-num">6</span>
              <div class="step-box sky">
                <span class="step-lbl">RTE / VFB</span>
                <span class="step-val" id="trace-rte-api">Rte_Read_rpEngine()</span>
                <span class="step-sub">Inter-Runnable Buffer</span>
              </div>
            </div>
            <span class="trace-arrow">➜</span>
            <div class="trace-step">
              <span class="step-num">7</span>
              <div class="step-box violet">
                <span class="step-lbl">APPLICATION SWC</span>
                <span class="step-val">${auto.swcs && auto.swcs[0] ? auto.swcs[0].name : 'EngineCtrl_SWC'}</span>
                <span class="step-sub">Runnable 10ms Task</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Standard Tiered AUTOSAR Architecture Stack -->
        <div class="autosar-stack-diagram">

          <!-- 1. APPLICATION LAYER (ASW) -->
          <div class="autosar-layer autosar-layer-asw">
            <div class="layer-header">
              <span class="layer-tag violet">LAYER 1</span>
              <span class="layer-name">APPLICATION LAYER (ASW) — SOFTWARE COMPONENTS (SWC)</span>
              <span class="layer-desc">Platform-independent functional software components, ports, interfaces &amp; runnables</span>
            </div>
            <div class="layer-body swc-grid">
    `;

    (auto.swcs || []).forEach(swc => {
      html += `
        <div class="autosar-swc-card" data-swc="${swc.name}">
          <div class="swc-card-top">
            <span class="swc-icon">🧩</span>
            <div class="swc-title">
              <strong>${swc.name}</strong>
              <span class="swc-type">${swc.type}</span>
            </div>
          </div>
          <div class="swc-desc">${swc.desc}</div>
          
          <!-- Ports & Interfaces -->
          <div class="swc-ports-section">
            <div class="port-subhead">PORTS &amp; INTERFACES:</div>
            <div class="port-chips">
      `;

      (swc.ports || []).forEach(p => {
        const isProvided = p.type.includes('Provided') || p.type.includes('P-PORT');
        const icon = isProvided ? '⊚ P-Port' : '⊏ R-Port';
        const colorCls = isProvided ? 'p-port' : 'r-port';
        html += `
          <div class="port-chip ${colorCls}" title="Interface: ${p.iface}">
            <span class="port-glyph">${icon}</span>
            <span class="port-name">${p.name}</span>
          </div>
        `;
      });

      html += `
            </div>
          </div>

          <!-- Runnables -->
          <div class="swc-runnables-section">
            <div class="runnable-subhead">RUNNABLES:</div>
            <div class="runnable-chips">
      `;

      (swc.runnables || []).forEach(r => {
        html += `
          <div class="runnable-chip">
            <span class="run-name">⚙️ ${r.name}()</span>
            <span class="run-trigger">[${r.trigger}]</span>
          </div>
        `;
      });

      html += `
            </div>
          </div>
        </div>
      `;
    });

    html += `
            </div>
          </div>

          <!-- 2. RUNTIME ENVIRONMENT (RTE) LAYER -->
          <div class="autosar-layer autosar-layer-rte">
            <div class="layer-header">
              <span class="layer-tag sky">LAYER 2</span>
              <span class="layer-name">AUTOSAR RUNTIME ENVIRONMENT (RTE) / VIRTUAL FUNCTIONAL BUS (VFB)</span>
              <span class="layer-desc">Decouples ASW from BSW. Implements inter-runnable memory copy, port mappings &amp; standardized C APIs</span>
            </div>
            <div class="layer-body rte-grid">
              <div class="rte-buffers-panel">
                <div class="rte-subhead">LIVE RTE SIGNAL BUFFERS &amp; VFB ACCESSORS:</div>
                <div class="rte-signal-chips" id="autosar-rte-signals">
                  <!-- Populated by renderAutosarLiveTelemetry() -->
                </div>
              </div>
              <div class="rte-apis-panel">
                <div class="rte-subhead">STANDARDIZED RTE GENERATED C CODE SIGNATURES:</div>
                <pre class="rte-code-block"><code>${(auto.rte && auto.rte.apis) ? auto.rte.apis.join('\n') : '// Standardized RTE C APIs'}</code></pre>
              </div>
            </div>
          </div>

          <!-- 3. BASIC SOFTWARE (BSW) LAYER -->
          <div class="autosar-layer autosar-layer-bsw">
            <div class="layer-header">
              <span class="layer-tag emerald">LAYER 3</span>
              <span class="layer-name">BASIC SOFTWARE (BSW) — SYSTEM, MEMORY, DIAGNOSTICS &amp; COMMUNICATION</span>
              <span class="layer-desc">Standardized system services, hardware abstractions, diagnostics, and communication stacks</span>
            </div>

            <!-- BSW Tier 3.1: Services Layer -->
            <div class="bsw-subtier services-tier">
              <div class="subtier-header">
                <span class="tier-pill green">BSW TIER 3.1: SERVICES LAYER</span>
                <span class="tier-desc">OS (OSEK), EcuM, BswM, WdgM, COM, PduR, Dcm, Dem, NvM</span>
              </div>
              <div class="modules-horizontal-grid">
    `;

    const bswServices = (auto.bsw && auto.bsw.services) ? auto.bsw.services : [];
    bswServices.forEach(mod => {
      html += `
        <div class="autosar-module-block service-block" data-mod="${mod.id}" title="${mod.desc}">
          <div class="mod-top">
            <span class="mod-name">${mod.id}</span>
            <span class="mod-cat">${mod.cat}</span>
          </div>
          <div class="mod-full">${mod.name}</div>
          <div class="mod-desc">${mod.desc.slice(0, 68)}...</div>
        </div>
      `;
    });

    html += `
              </div>
            </div>

            <!-- BSW Tier 3.2: ECU Abstraction Layer -->
            <div class="bsw-subtier abstraction-tier">
              <div class="subtier-header">
                <span class="tier-pill amber">BSW TIER 3.2: ECU ABSTRACTION LAYER</span>
                <span class="tier-desc">CanIf, CanTp, IoHwAb, MemIf, Fee — Decouples BSW from target microcontroller</span>
              </div>
              <div class="modules-horizontal-grid">
    `;

    const bswAbs = (auto.bsw && auto.bsw.abstraction) ? auto.bsw.abstraction : [];
    bswAbs.forEach(mod => {
      html += `
        <div class="autosar-module-block abs-block" data-mod="${mod.id}" title="${mod.desc}">
          <div class="mod-top">
            <span class="mod-name">${mod.id}</span>
            <span class="mod-cat">${mod.cat}</span>
          </div>
          <div class="mod-full">${mod.name}</div>
          <div class="mod-desc">${mod.desc.slice(0, 68)}...</div>
        </div>
      `;
    });

    html += `
              </div>
            </div>

            <!-- BSW Tier 3.3: Microcontroller Abstraction Layer (MCAL) -->
            <div class="bsw-subtier mcal-tier">
              <div class="subtier-header">
                <span class="tier-pill orange">BSW TIER 3.3: MICROCONTROLLER ABSTRACTION LAYER (MCAL)</span>
                <span class="tier-desc">CanDrv, Mcu, Port, Dio, Adc, Gpt — Direct register access to silicon peripherals</span>
              </div>
              <div class="modules-horizontal-grid">
    `;

    const bswMcal = (auto.bsw && auto.bsw.mcal) ? auto.bsw.mcal : [];
    bswMcal.forEach(mod => {
      html += `
        <div class="autosar-module-block mcal-block" data-mod="${mod.id}" title="${mod.desc}">
          <div class="mod-top">
            <span class="mod-name">${mod.id}</span>
            <span class="mod-cat">${mod.cat}</span>
          </div>
          <div class="mod-full">${mod.name}</div>
          <div class="mod-desc">${mod.desc.slice(0, 68)}...</div>
        </div>
      `;
    });

    html += `
              </div>
            </div>

          </div>

          <!-- 4. MICROCONTROLLER HARDWARE (HW) LAYER -->
          <div class="autosar-layer autosar-layer-hw">
            <div class="layer-header">
              <span class="layer-tag slate">LAYER 4</span>
              <span class="layer-name">PHYSICAL HARDWARE (SILICON MCU, TRANSCEIVER &amp; CAN BUS TERMINATION)</span>
              <span class="layer-desc">Target silicon microcontrollers, high-speed physical transceivers, and ISO 11898-2 transmission line</span>
            </div>
            <div class="layer-body hw-grid">
              <div class="hw-item-card">
                <div class="hw-item-icon">🖲️</div>
                <div class="hw-item-info">
                  <span class="hw-item-lbl">TARGET SILICON MCU</span>
                  <strong class="hw-item-val cyan">${sil.mcu || 'Infineon AURIX™ TC397 (Triple TriCore 300MHz)'}</strong>
                  <span class="hw-item-meta">ASIL-D Certified | Hardware Security Module (HSM) | 16MB Flash</span>
                </div>
              </div>
              <div class="hw-item-card">
                <div class="hw-item-icon">⚡</div>
                <div class="hw-item-info">
                  <span class="hw-item-lbl">CAN TRANSCEIVER</span>
                  <strong class="hw-item-val green">${sil.transceiver || 'NXP TJA1044GT High-Speed CAN Transceiver'}</strong>
                  <span class="hw-item-meta">2.5 kV Galvanic Isolation | Standby Mode with Bus Wakeup</span>
                </div>
              </div>
              <div class="hw-item-card">
                <div class="hw-item-icon">➰</div>
                <div class="hw-item-info">
                  <span class="hw-item-lbl">PHYSICAL DIFFERENTIAL LINES</span>
                  <strong class="hw-item-val amber">CAN_H (3.5V Dominant) &amp; CAN_L (1.5V Dominant)</strong>
                  <span class="hw-item-meta">Split 120 Ω End-Point Termination | Common-Mode Choke</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Interactive AUTOSAR Module Inspector Drawer/Modal -->
        <div class="autosar-module-inspector" id="autosar-module-inspector" style="display: none;">
          <div class="inspector-card">
            <div class="inspector-header">
              <div class="ins-title-group">
                <span class="ins-badge" id="ins-badge">AUTOSAR SWS</span>
                <h4 class="ins-title" id="ins-title">AUTOSAR COM Module (Release 4.4.0)</h4>
              </div>
              <button class="ins-close-btn" id="ins-close-btn">✕</button>
            </div>
            <div class="inspector-body">
              <div class="ins-desc" id="ins-desc">
                Standardized AUTOSAR Communication module providing signal packing, transfer modes, and I-PDU serialization.
              </div>
              <div class="ins-section">
                <span class="ins-sec-title">STANDARDIZED AUTOSAR C FUNCTION PROTOTYPES:</span>
                <pre class="ins-code-block"><code id="ins-apis">Std_ReturnType Com_SendSignal(Com_SignalIdType SignalId, const void *SignalDataPtr);</code></pre>
              </div>
              <div class="ins-section">
                <span class="ins-sec-title">CONFIGURATION &amp; RUNTIME STATUS:</span>
                <div class="ins-props-grid" id="ins-props">
                  <div class="prop-item"><span class="k">Module State:</span><span class="v green">INITIALIZED (COM_INIT)</span></div>
                  <div class="prop-item"><span class="k">I-PDU Direction:</span><span class="v cyan">TRANSMIT &amp; RECEIVE</span></div>
                  <div class="prop-item"><span class="k">Transmission Mode:</span><span class="v">CYCLIC (10ms)</span></div>
                  <div class="prop-item"><span class="k">Signal Gateways:</span><span class="v">4 Configured</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    this.dom.autosarContainer.innerHTML = html;

    // Attach click listeners to all module blocks
    const moduleBlocks = this.dom.autosarContainer.querySelectorAll('.autosar-module-block');
    moduleBlocks.forEach(blk => {
      blk.addEventListener('click', () => {
        const modId = blk.getAttribute('data-mod');
        this.openModuleInspector(modId);
      });
    });

    const closeBtn = document.getElementById('ins-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const ins = document.getElementById('autosar-module-inspector');
        if (ins) ins.style.display = 'none';
      });
    }

    this.renderAutosarLiveTelemetry();
  }

  openModuleInspector(modId) {
    const node = this.getSelectedNode();
    if (!node || !node.autosar || !node.autosar.bsw) return;

    const bsw = node.autosar.bsw;
    const allMods = [...(bsw.services || []), ...(bsw.abstraction || []), ...(bsw.mcal || [])];
    const mod = allMods.find(m => m.id === modId);
    if (!mod) return;

    const ins = document.getElementById('autosar-module-inspector');
    const insTitle = document.getElementById('ins-title');
    const insDesc = document.getElementById('ins-desc');
    const insApis = document.getElementById('ins-apis');
    const insBadge = document.getElementById('ins-badge');
    const insProps = document.getElementById('ins-props');

    if (ins && insTitle && insDesc && insApis) {
      insBadge.textContent = `AUTOSAR SWS ${mod.id}`;
      insTitle.textContent = `${mod.name} (${mod.cat})`;
      insDesc.textContent = `${mod.desc} Conforms to AUTOSAR Release 4.4.0 Software Specification SWS_${mod.id}_00001.`;
      
      const apis = (mod.apis && mod.apis.length > 0) ? mod.apis.join('\n') : `// Standard AUTOSAR ${mod.id} APIs\nStd_ReturnType ${mod.id}_Init(const ${mod.id}_ConfigType* ConfigPtr);`;
      insApis.textContent = apis;

      if (insProps) {
        insProps.innerHTML = `
          <div class="prop-item"><span class="k">Module Identifier:</span><span class="v cyan">${mod.id}</span></div>
          <div class="prop-item"><span class="k">AUTOSAR Category:</span><span class="v amber">${mod.cat}</span></div>
          <div class="prop-item"><span class="k">Operational Status:</span><span class="v green">ONLINE (ACTIVE)</span></div>
          <div class="prop-item"><span class="k">Conformance Class:</span><span class="v">AUTOSAR CP R4.4.0</span></div>
          <div class="prop-item"><span class="k">Safety Integrity:</span><span class="v">${node.autosar.safetyRating || 'ASIL-D'}</span></div>
          <div class="prop-item"><span class="k">Processed Frames:</span><span class="v mono green">${this.packetCounters[node.id] || 0}</span></div>
        `;
      }

      ins.style.display = 'block';
      ins.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  renderAutosarLiveTelemetry() {
    const rteSignalsContainer = document.getElementById('autosar-rte-signals');
    if (!rteSignalsContainer) return;

    const node = this.getSelectedNode();
    if (!node) return;

    let html = '';
    node.signals.forEach(sig => {
      let val = this.latestTelemetry[sig];
      let displayVal = val;
      if (sig === 'EngineSpeed') displayVal = `${Math.round(val || 0)} RPM`;
      else if (sig === 'VehicleSpeed') displayVal = `${(val || 0).toFixed(1)} km/h`;
      else if (sig === 'ThrottlePosition') displayVal = `${(val || 0).toFixed(1)} %`;
      else if (sig === 'EngineTemp') displayVal = `${(val || 0).toFixed(1)} °C`;
      else if (sig === 'OilPressure') displayVal = `${(val || 0).toFixed(2)} bar`;
      else if (sig === 'SteeringAngle') displayVal = `${(val || 0).toFixed(1)}°`;
      else if (sig === 'FuelLevel') displayVal = `${(val || 0).toFixed(1)} %`;
      else if (sig === 'BatterySOC') displayVal = `${(val || 0).toFixed(1)} %`;
      else if (sig === 'Gear') displayVal = `Gear ${val || 'D'}`;
      else if (typeof val === 'boolean') displayVal = val ? 'TRUE' : 'FALSE';
      if (val === undefined || val === null) displayVal = '--';

      html += `
        <div class="rte-sig-chip">
          <span class="sig-name">Rte_Read_${sig}()</span>
          <span class="sig-val cyan">${displayVal}</span>
        </div>
      `;
    });

    rteSignalsContainer.innerHTML = html;
  }

  // ================= FORMAL AUTOSAR ARXML VIEWER & EXPORTER =================
  renderArxmlInspector() {
    if (!this.dom.arxmlContainer) return;
    const node = this.getSelectedNode();
    if (!node) return;

    const arxmlContent = this.generateArxmlSnippet(node);

    let html = `
      <div class="arxml-viewer-wrapper">
        <div class="arxml-toolbar">
          <div class="arxml-title-group">
            <span class="arxml-tag">ARXML</span>
            <span class="arxml-filename">${node.id}_Extract_R4.4.arxml</span>
            <span class="arxml-schema-tag">AUTOSAR Schema R4.4.0</span>
          </div>
          <div class="arxml-actions">
            <button class="btn btn-sm btn-outline-cyan" id="btn-copy-arxml">📋 Copy ARXML</button>
            <button class="btn btn-sm btn-outline-green" id="btn-download-arxml">💾 Download .arxml</button>
          </div>
        </div>
        <div class="arxml-editor-box">
          <pre class="arxml-code"><code id="arxml-code-content">${this.escapeXml(arxmlContent)}</code></pre>
        </div>
      </div>
    `;

    this.dom.arxmlContainer.innerHTML = html;

    const btnCopy = document.getElementById('btn-copy-arxml');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(arxmlContent).then(() => {
          btnCopy.textContent = '✅ Copied!';
          setTimeout(() => btnCopy.textContent = '📋 Copy ARXML', 2000);
        });
      });
    }

    const btnDownload = document.getElementById('btn-download-arxml');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        const blob = new Blob([arxmlContent], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${node.id}_AUTOSAR_4.4.arxml`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }

  escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }

  generateArxmlSnippet(node) {
    const auto = node.autosar || {};
    const swcList = auto.swcs || [];
    const mainSwc = swcList[0] || { name: `${node.id}_SWC` };

    let swcPortsXml = '';
    (mainSwc.ports || []).forEach(p => {
      const isProvided = p.type.includes('Provided') || p.type.includes('P-PORT');
      const tag = isProvided ? 'P-PORT-PROTOTYPE' : 'R-PORT-PROTOTYPE';
      swcPortsXml += `
            <${tag}>
              <SHORT-NAME>${p.name}</SHORT-NAME>
              <PROVIDED-INTERFACE-TREF DEST="SENDER-RECEIVER-INTERFACE">/Interfaces/${p.iface}</PROVIDED-INTERFACE-TREF>
            </${tag}>`;
    });

    let runnablesXml = '';
    (mainSwc.runnables || []).forEach(r => {
      runnablesXml += `
              <RUNNABLE-ENTITY>
                <SHORT-NAME>${r.name}</SHORT-NAME>
                <MINIMUM-START-INTERVAL>0.010</MINIMUM-START-INTERVAL>
                <CAN-BE-INVOKED-CONCURRENTLY>false</CAN-BE-INVOKED-CONCURRENTLY>
                <SYMBOL>${r.name}</SYMBOL>
              </RUNNABLE-ENTITY>`;
    });

    let signalsXml = '';
    node.signals.forEach(sig => {
      signalsXml += `
        <I-SIGNAL>
          <SHORT-NAME>ISig_${sig}</SHORT-NAME>
          <DATA-TYPE-POLICY>AUTOSAR-STANDARD</DATA-TYPE-POLICY>
          <LENGTH>16</LENGTH>
          <NETWORK-REPRESENTATION-PROPERTIES>
            <SYSTEM-SIGNAL-REF DEST="SYSTEM-SIGNAL">/SystemSignals/SysSig_${sig}</SYSTEM-SIGNAL-REF>
          </NETWORK-REPRESENTATION-PROPERTIES>
        </I-SIGNAL>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ===================================================================== -->
<!-- AUTOSAR Formal ARXML Description Extract                              -->
<!-- ECU Identifier: ${node.id}                                           -->
<!-- Standard: AUTOSAR Classic Release 4.4.0 (R20-11)                      -->
<!-- Generated by OpenTwin Automotive Workbench                           -->
<!-- ===================================================================== -->
<AUTOSAR xmlns="http://autosar.org/schema/r4.0" 
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
         xsi:schemaLocation="http://autosar.org/schema/r4.0 AUTOSAR_4-4-0.xsd">
  <AR-PACKAGES>
    <AR-PACKAGE>
      <SHORT-NAME>VehicleProject</SHORT-NAME>
      <AR-PACKAGES>

        <!-- Application Software Components (ASW) -->
        <AR-PACKAGE>
          <SHORT-NAME>ComponentTypes</SHORT-NAME>
          <ELEMENTS>
            <APPLICATION-SW-COMPONENT-TYPE>
              <SHORT-NAME>${mainSwc.name}</SHORT-NAME>
              <PORTS>${swcPortsXml}
              </PORTS>
              <INTERNAL-BEHAVIORS>
                <SWC-INTERNAL-BEHAVIOR>
                  <SHORT-NAME>${mainSwc.name}_IB</SHORT-NAME>
                  <RUNNABLES>${runnablesXml}
                  </RUNNABLES>
                </SWC-INTERNAL-BEHAVIOR>
              </INTERNAL-BEHAVIORS>
            </APPLICATION-SW-COMPONENT-TYPE>
          </ELEMENTS>
        </AR-PACKAGE>

        <!-- Communication & I-PDU Definitions -->
        <AR-PACKAGE>
          <SHORT-NAME>Communication</SHORT-NAME>
          <ELEMENTS>
            <I-SIGNAL-I-PDU>
              <SHORT-NAME>${node.id}_Tx_PDU</SHORT-NAME>
              <LENGTH>8</LENGTH>
              <I-PDU-TIMING-SPECIFICATIONS>
                <I-PDU-TIMING>
                  <TRANSMISSION-MODE-DECLARATION>
                    <TRANSMISSION-MODE-TRUE-TIMING>
                      <CYCLIC-TIMING>
                        <TIME-PERIOD>
                          <VALUE>0.010</VALUE>
                        </TIME-PERIOD>
                      </CYCLIC-TIMING>
                    </TRANSMISSION-MODE-TRUE-TIMING>
                  </TRANSMISSION-MODE-DECLARATION>
                </I-PDU-TIMING>
              </I-PDU-TIMING-SPECIFICATIONS>
            </I-SIGNAL-I-PDU>${signalsXml}
          </ELEMENTS>
        </AR-PACKAGE>

        <!-- CAN Cluster & Physical Channel -->
        <AR-PACKAGE>
          <SHORT-NAME>NetworkTopology</SHORT-NAME>
          <ELEMENTS>
            <CAN-CLUSTER>
              <SHORT-NAME>VehicleCAN_Cluster</SHORT-NAME>
              <CAN-CLUSTER-VARIANTS>
                <CAN-CLUSTER-CONDITIONAL>
                  <BAUDRATE>500000</BAUDRATE>
                  <PHYSICAL-CHANNELS>
                    <CAN-PHYSICAL-CHANNEL>
                      <SHORT-NAME>CAN_Physical_Channel</SHORT-NAME>
                      <COMM-CONTROLLERS>
                        <COMMUNICATION-CONTROLLER-REF-CONDITIONAL>
                          <COMMUNICATION-CONTROLLER-REF DEST="CAN-COMMUNICATION-CONTROLLER">/Hardware/${node.id}/CanCtrl0</COMMUNICATION-CONTROLLER-REF>
                        </COMMUNICATION-CONTROLLER-REF-CONDITIONAL>
                      </COMM-CONTROLLERS>
                    </CAN-PHYSICAL-CHANNEL>
                  </PHYSICAL-CHANNELS>
                </CAN-CLUSTER-CONDITIONAL>
              </CAN-CLUSTER-VARIANTS>
            </CAN-CLUSTER>
          </ELEMENTS>
        </AR-PACKAGE>

        <!-- Hardware & Target Silicon Definition -->
        <AR-PACKAGE>
          <SHORT-NAME>Hardware</SHORT-NAME>
          <ELEMENTS>
            <HW-ELEMENT>
              <SHORT-NAME>${node.id}</SHORT-NAME>
              <HW-CATEGORY>ECU</HW-CATEGORY>
              <SILICON-TARGET>${auto.targetSilicon ? auto.targetSilicon.mcu : 'Infineon AURIX TC397'}</SILICON-TARGET>
              <SAFETY-INTEGRITY-LEVEL>${auto.safetyRating || 'ISO 26262 ASIL-D'}</SAFETY-INTEGRITY-LEVEL>
            </HW-ELEMENT>
          </ELEMENTS>
        </AR-PACKAGE>

      </AR-PACKAGES>
    </AR-PACKAGE>
  </AR-PACKAGES>
</AUTOSAR>`;
  }

  renderNodeDetail() {
    const node = this.getSelectedNode();
    if (!node) return;

    if (this.dom.detailType) this.dom.detailType.textContent = node.type;
    if (this.dom.detailName) this.dom.detailName.textContent = node.name;
    if (this.dom.detailId) this.dom.detailId.textContent = node.canIdHex;
    if (this.dom.detailFrameId) this.dom.detailFrameId.textContent = `${node.canIdHex} (${node.canIdDec})`;
    if (this.dom.detailCycle) this.dom.detailCycle.textContent = node.cycleTime;
    if (this.dom.detailDlc) this.dom.detailDlc.textContent = node.dlc;
    if (this.dom.detailPayload) this.dom.detailPayload.textContent = node.payloadType;

    if (this.dom.btnToggleNode) {
      if (node.status === 'ONLINE') {
        this.dom.btnToggleNode.textContent = '⚠️ Drop Node (Offline)';
        this.dom.btnToggleNode.className = 'btn btn-sm btn-danger';
      } else {
        this.dom.btnToggleNode.textContent = '✅ Restore Node (Online)';
        this.dom.btnToggleNode.className = 'btn btn-sm btn-success';
      }
    }

    if (this.dom.detailSignalsList) {
      let tableHtml = `
        <table class="signals-table">
          <thead>
            <tr>
              <th width="35%">SIGNAL IDENTIFIER</th>
              <th width="30%">CURRENT VALUE</th>
              <th width="35%">STATUS &amp; RANGE</th>
            </tr>
          </thead>
          <tbody>
      `;

      node.signals.forEach(sigName => {
        const val = this.latestTelemetry[sigName];
        const displayVal = (val !== undefined && val !== null) ? val : '--';
        tableHtml += `
          <tr>
            <td class="sig-name"><code>${sigName}</code></td>
            <td class="sig-val cyan" id="detail-sig-${sigName}">${displayVal}</td>
            <td class="sig-status"><span class="sig-badge green">ACTIVE (IN-RANGE)</span></td>
          </tr>
        `;
      });

      tableHtml += `</tbody></table>`;
      this.dom.detailSignalsList.innerHTML = tableHtml;
    }

    this.renderNodeTelemetry();
  }

  renderNodeTelemetry() {
    const topo = this.getCurrentTopology();

    topo.nodes.forEach(node => {
      const pktElem = document.getElementById(`pkt-${node.id}`);
      if (pktElem) {
        pktElem.textContent = `${this.packetCounters[node.id] || 0} frames`;
      }

      const cardSignalsElem = document.getElementById(`live-card-signals-${node.id}`);
      if (cardSignalsElem) {
        let chips = '';
        node.signals.slice(0, 3).forEach(sig => {
          let val = this.latestTelemetry[sig];
          if (typeof val === 'number') val = val.toFixed(1);
          if (val === undefined || val === null) val = '--';
          chips += `<span class="signal-chip"><strong>${sig.slice(0, 8)}:</strong> ${val}</span>`;
        });
        cardSignalsElem.innerHTML = chips;
      }
    });

    const selected = this.getSelectedNode();
    if (selected) {
      selected.signals.forEach(sig => {
        const elem = document.getElementById(`detail-sig-${sig}`);
        if (elem) {
          let val = this.latestTelemetry[sig];
          let formatted = val;
          if (sig === 'EngineSpeed') formatted = `${Math.round(val || 0)} RPM`;
          else if (sig === 'VehicleSpeed') formatted = `${(val || 0).toFixed(1)} km/h`;
          else if (sig === 'ThrottlePosition') formatted = `${(val || 0).toFixed(1)} %`;
          else if (sig === 'EngineTemp') formatted = `${(val || 0).toFixed(1)} °C`;
          else if (sig === 'OilPressure') formatted = `${(val || 0).toFixed(2)} bar`;
          else if (sig === 'SteeringAngle') formatted = `${(val || 0).toFixed(1)}°`;
          else if (sig === 'FuelLevel') formatted = `${(val || 0).toFixed(1)} %`;
          else if (sig === 'BatterySOC') formatted = `${(val || 0).toFixed(1)} %`;
          else if (sig === 'Odometer') formatted = `${(val || 0).toFixed(1)} km`;
          else if (sig === 'Gear') formatted = `Gear ${val || 'D'}`;
          else if (typeof val === 'boolean') formatted = val ? 'ACTIVE (TRUE)' : 'INACTIVE (FALSE)';
          elem.textContent = (val !== undefined && val !== null) ? formatted : '--';
        }
      });
    }
  }
}
