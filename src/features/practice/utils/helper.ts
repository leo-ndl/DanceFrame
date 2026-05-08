import { logger } from "@/shared/utils/logger";
import { Frame } from "react-native-vision-camera";

export function extractFrame(frame: Frame): Uint8Array<ArrayBufferLike> {
    'worklet';
    if(!frame) {
        logger.error('No frame provided');
        throw new Error("No frame provided");
    }

    if (frame.pixelFormat !== 'rgb') {
        logger.error('Frame pixel format is not RGB');
        throw new Error("Frame pixel format is not RGB");
    }
    
    const buffer = frame.toArrayBuffer()
    const data = new Uint8Array(buffer)
    logger.info(`Pixel at 0,0: RGB(${data[0]}, ${data[1]}, ${data[2]})`)
  
 return data;
}