//
//  PoseLandmarks.swift
//  movement
//

import Foundation
import React
import MediaPipeTasksVision

@objc(PoseLandmarks)
class PoseLandmarks: RCTEventEmitter {
  
  @objc
  override static func moduleName() -> String! {
    return "PoseLandmarks"
  }
  
  override init() {
    super.init()
    // Don't auto-initialize - will be called manually when needed
  }
  
  override func supportedEvents() -> [String]! {
    return ["onPoseLandmarksDetected", "onPoseLandmarksStatus", "onPoseLandmarksError"]
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func initModel() {
    if PoseLandmarkerHolder.shared.getPoseLandmarker() != nil {
      self.sendEvent(withName: "onPoseLandmarksStatus", body: ["status": "Model already initialized"])
      return
    }
    
    guard let modelPath = Bundle.main.path(forResource: "pose_landmarker_lite", ofType: "task") else {
      self.sendEvent(withName: "onPoseLandmarksError", body: ["error": "Model file not found"])
      return
    }
    
    let baseOptions = BaseOptions()
    baseOptions.modelAssetPath = modelPath
    
    let options = PoseLandmarkerOptions()
    options.baseOptions = baseOptions
    options.runningMode = .liveStream
    options.numPoses = 1
    options.minPoseDetectionConfidence = 0.8
    options.minPosePresenceConfidence = 0.8
    options.minTrackingConfidence = 0.8
    
    options.poseLandmarkerLiveStreamDelegate = self
    
    do {
      try PoseLandmarkerHolder.shared.initializePoseLandmarker(with: options)
      self.sendEvent(withName: "onPoseLandmarksStatus", body: ["status": "Model initialized successfully"])
    } catch {
      self.sendEvent(withName: "onPoseLandmarksError", body: ["error": error.localizedDescription])
    }
  }
  
  @objc
  func clearModel() {
    PoseLandmarkerHolder.shared.clearPoseLandmarker()
  }
}

extension PoseLandmarks: PoseLandmarkerLiveStreamDelegate {
  func poseLandmarker(_ poseLandmarker: PoseLandmarker, didFinishDetection result: PoseLandmarkerResult?, timestampInMilliseconds: Int, error: Error?) {
    
    if let error = error {
      self.sendEvent(withName: "onPoseLandmarksError", body: ["error": error.localizedDescription])
      return
    }
    
    guard let result = result, let landmarks = result.landmarks.first else {
      return
    }
    
    var landmarksArray: [[String: Any]] = []
    
    for (index, landmark) in landmarks.enumerated() {
      let landmarkDict: [String: Any] = [
        "keypoint": index,
        "x": landmark.x,
        "y": landmark.y,
        "z": landmark.z,
        "visibility": landmark.visibility?.floatValue ?? 0.0,
        "presence": landmark.presence?.floatValue ?? 0.0
      ]
      landmarksArray.append(landmarkDict)
    }
    
    self.sendEvent(withName: "onPoseLandmarksDetected", body: ["landmarks": [landmarksArray]])
  }
}
