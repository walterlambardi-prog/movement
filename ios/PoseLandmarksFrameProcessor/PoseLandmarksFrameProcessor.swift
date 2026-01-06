//
//  PoseLandmarksFrameProcessor.swift
//  movement
//

import VisionCamera
import MediaPipeTasksVision

@objc(PoseLandmarksFrameProcessorPlugin)
public class PoseLandmarksFrameProcessorPlugin: FrameProcessorPlugin {
  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
    
    guard let poseLandmarker = PoseLandmarkerHolder.shared.getPoseLandmarker() else {
      print("PoseLandmarker is not initialized.")
      return "PoseLandmarker is not initialized"
    }
    
    let image = MPImage(sampleBuffer: frame.buffer, orientation: .up)
    
    do {
      try poseLandmarker.detectAsync(image: image, timestampInMilliseconds: Int(frame.timestamp))
      return "Frame processed successfully"
    } catch {
      print("Error processing frame: \(error.localizedDescription)")
      return "Error processing frame: \(error.localizedDescription)"
    }
  }
}
