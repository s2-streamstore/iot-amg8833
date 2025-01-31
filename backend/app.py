import asyncio
import os
import json
import time
import numpy as np
from typing import AsyncIterable
from streamstore import S2
from streamstore.schemas import AppendInput, Record
from scipy.ndimage import label, generate_binary_structure, measurements

import busio
import adafruit_amg88xx
import board

AUTH_TOKEN = os.getenv("S2_AUTH_TOKEN")
BASIN = os.getenv("BASIN")
STREAM = os.getenv("STREAM")


def initialize_sensor():    
    t0 = time.time()
    sensor = None
    while time.time() - t0 < 1 and not sensor:        
        try:
            i2c_bus = busio.I2C(board.SCL, board.SDA)
            sensor = adafruit_amg88xx.AMG88XX(i2c_bus)            
            return sensor
        except Exception:
            continue
    raise RuntimeError("Failed to initialize AMG8833 sensor")


async def sensor_data_gen(sensor) -> AsyncIterable[AppendInput]:    
    while True:
        try:
            loop = asyncio.get_running_loop()
            pixels = await loop.run_in_executor(
                None, lambda: sensor.pixels
            )

            pixels = np.array(pixels)
                        
            binary_mask = pixels > 28
            structure = generate_binary_structure(2, 2)
            labeled_array, num_features = label(binary_mask, structure=structure)
                    
            connections = sum(
                [
                    np.count_nonzero(labeled_array == i) > 4
                    for i in range(1, num_features + 1)
                ]
            )

            occupied = bool(connections > 0)
            occupied = {"occupied": occupied, "grid": pixels.tolist()}

            print(occupied)

            yield AppendInput(
                records=[Record(body=json.dumps(occupied).encode("utf-8"))]
            )
                        
        except Exception as e:
            print(f"Sensor error: {str(e)}")
            await asyncio.sleep(5.0)


async def producer(sensor):
    async with S2(auth_token=AUTH_TOKEN) as s2:
        stream = s2[BASIN][STREAM]
        async for output in stream.append_session(sensor_data_gen(sensor)):
            print(f"Appended {output.end_seq_num - output.start_seq_num} records")


if __name__ == "__main__":
    sensor = initialize_sensor()
    try:
        asyncio.run(producer(sensor))
    except KeyboardInterrupt:
        print("\nStopping thermal stream...")
