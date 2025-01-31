"use client"

import { useEffect, useRef, useState } from "react"
import { S2 } from "@s2-dev/streamstore"
import { ReadAcceptEnum } from "@s2-dev/streamstore/funcs/streamRead"
import { EventStream } from "@s2-dev/streamstore/lib/event-streams"
import { ReadResponse1 } from "@s2-dev/streamstore/models/components/readresponse"
import { Output1 } from "@s2-dev/streamstore/models/components/output"

const basinUrl = "https://monitors.b.aws.s2.dev/v1alpha"
const s2 = new S2({
    bearerAuth: process.env.NEXT_S2_API_KEY,
})

interface SensorData {
    occupied: boolean;
    grid: number[][];
}

export default function AMG8833() {
    const [occupied, setOccupied] = useState(false)
    const [temperatureGrid, setTemperatureGrid] = useState<number[][]>([])
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const fetchStream = async () => {
            try {
                const tail = await s2.stream.checkTail(
                    { stream: "amg8833" },
                    {
                        serverURL: basinUrl,
                    },
                )
                const result = await s2.stream.read(
                    { stream: "amg8833", startSeqNum: tail.nextSeqNum },
                    {
                        serverURL: basinUrl,
                        acceptHeaderOverride: ReadAcceptEnum.textEventStream,
                    },
                )
                if (result instanceof EventStream) {
                    for await (const event of result) {
                        if ((event as ReadResponse1).data) {
                            const outputData = event.data
                            if ((outputData as Output1).batch) {
                                const records = (outputData as Output1).batch.records;
                                for (const record of records) {                                    
                                    const sensorData = JSON.parse(record.body) as SensorData;
                                    setOccupied(sensorData.occupied)
                                    setTemperatureGrid(sensorData.grid)                                    
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching stream:", error)
            }
        }
        fetchStream()
    }, [])

    useEffect(() => {
        if (temperatureGrid.length > 0) {
            drawThermalImage()
        }
    }, [temperatureGrid])

    const getColorForTemperature = (temp: number): string => {
        const minTemp = 19
        const maxTemp = 32
        const normalizedTemp = (temp - minTemp) / (maxTemp - minTemp)
        const hue = (1 - normalizedTemp) * 240
        return `hsl(${hue}, 100%, 50%)`
    }

    const drawThermalImage = () => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const cellWidth = canvas.width / temperatureGrid[0].length
        const cellHeight = canvas.height / temperatureGrid.length

        temperatureGrid.forEach((row, y) => {
            row.forEach((temp, x) => {
                const color = getColorForTemperature(temp)
                ctx.fillStyle = color
                ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight)
            })
        })
    }
    return (
        <div className="flex flex-col ">
            <div className={`h-8 w-full rounded-lg ${occupied ? "bg-red-500" : "bg-green-500"}`} />
            <div className="flex-grow flex items-center justify-center">
                <canvas ref={canvasRef} width={800} height={800} className="max-w-full max-h-full rounded-lg" />
            </div>
        </div>
    )
}