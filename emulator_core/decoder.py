"""
OpenTwin CAN Decoder Module
Subscribes to the CAN transport layer, decodes raw hexadecimal frames using DBC matrices,
and yields structured telemetry representations.
"""

import os
import sys
import logging
import cantools
import can

logger = logging.getLogger("OpenTwin.Decoder")

class CANDecoder:
    def __init__(self, dbc_path: str):
        if not os.path.exists(dbc_path):
            raise FileNotFoundError(f"DBC file not found at: {dbc_path}")
        self.dbc_path = dbc_path
        self.db = cantools.database.load_file(dbc_path)
        logger.info(f"Loaded DBC database: {dbc_path} ({len(self.db.messages)} messages defined)")
        
        # Build quick lookup table for message names and IDs
        self.msg_lookup = {msg.frame_id: msg for msg in self.db.messages}

    def decode_frame(self, arbitration_id: int, data: bytes, timestamp: float = 0.0) -> dict:
        """
        Decodes a single CAN frame against the loaded DBC database.
        Returns a dict containing metadata, raw hex, and decoded signals.
        """
        hex_data = data.hex().upper()
        res = {
            "timestamp": timestamp,
            "can_id_hex": f"0x{arbitration_id:03X}",
            "can_id_dec": arbitration_id,
            "raw_hex": hex_data,
            "message_name": "UNKNOWN",
            "signals": {}
        }

        if arbitration_id in self.msg_lookup:
            msg_def = self.msg_lookup[arbitration_id]
            res["message_name"] = msg_def.name
            try:
                # decode_choices=False to keep numeric values or True for string choices
                # We extract numeric signals and convert choices where appropriate
                decoded = msg_def.decode(data, decode_choices=False)
                res["signals"] = decoded
            except Exception as e:
                logger.warning(f"Error decoding message 0x{arbitration_id:X}: {e}")
                res["decode_error"] = str(e)
        return res

def create_can_bus(channel: str = "vcan0", bustype: str = "socketcan", bitrate: int = 500000):
    """
    Instantiates a python-can Bus interface.
    Gracefully falls back to virtual interface if socketcan is unavailable (e.g. on Windows).
    """
    try:
        bus = can.interface.Bus(channel=channel, bustype=bustype, bitrate=bitrate)
        logger.info(f"Connected to CAN bus [channel={channel}, bustype={bustype}]")
        return bus
    except Exception as e:
        logger.warning(f"Failed to connect to {bustype} on {channel}: {e}. Falling back to virtual bus.")
        return can.interface.Bus(channel=channel, bustype="virtual", bitrate=bitrate)
