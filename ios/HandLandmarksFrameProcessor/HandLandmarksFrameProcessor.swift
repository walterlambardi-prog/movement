//
//  HandLandmarksFrameProcessor.swift
//  movement
//

import VisionCamera
import MediaPipeTasksVision

@objc(HandLandmarksFrameProcessorPlugin)
public class HandLandmarksFrameProcessorPlugin: FrameProcessorPlugin {
  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
    
    guard let handLandmarker = HandLandmarkerHolder.shared.getHandLandmarker() else {
      print("HandLandmarker is not initialized.")
      return "HandLandmarker is not initialized"
    }
    
    guard let image = try? MPImage(sampleBuffer: frame.buffer, orientation: .up) else {
      return "Failed to create MPImage"
    }
    
    do {
      try handLandmarker.detectAsync(image: image, timestampInMilliseconds: Int(frame.timestamp))
      return "Frame processed successfully"
    } catch {
      print("Error processing frame: \(error.localizedDescription)")
      return "Error processing frame: \(error.localizedDescription)"
    }
  }
}
