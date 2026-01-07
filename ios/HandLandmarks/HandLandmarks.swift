//
//  HandLandmarks.swift
//  movement
//

import Foundation
import React
import MediaPipeTasksVision

@objc(HandLandmarks)
class HandLandmarks: RCTEventEmitter {
  
  @objc
  override static func moduleName() -> String! {
    return "HandLandmarks"
  }
  
  override init() {
    super.init()
    // Don't auto-initialize - will be called manually when needed
  }
  
  override func supportedEvents() -> [String]! {
    return ["onHandLandmarksDetected", "onHandLandmarksStatus", "onHandLandmarksError"]
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func initModel() {
    if HandLandmarkerHolder.shared.getHandLandmarker() != nil {
      self.sendEvent(withName: "onHandLandmarksStatus", body: ["status": "Hand model already initialized"])
      return
    }
    
    guard let modelPath = Bundle.main.path(forResource: "hand_landmarker", ofType: "task") else {
      self.sendEvent(withName: "onHandLandmarksError", body: ["error": "Hand model file not found"])
      return
    }
    
    let baseOptions = BaseOptions()
    baseOptions.modelAssetPath = modelPath
    
    let options = HandLandmarkerOptions()
    options.baseOptions = baseOptions
    options.runningMode = .liveStream
    options.numHands = 2
    options.minHandDetectionConfidence = 0.5
    options.minHandPresenceConfidence = 0.5
    options.minTrackingConfidence = 0.5
    
    options.handLandmarkerLiveStreamDelegate = self
    
    do {
      try HandLandmarkerHolder.shared.initializeHandLandmarker(with: options)
      self.sendEvent(withName: "onHandLandmarksStatus", body: ["status": "Hand model initialized successfully"])
    } catch {
      self.sendEvent(withName: "onHandLandmarksError", body: ["error": error.localizedDescription])
    }
  }
  
  @objc
  func clearModel() {
    HandLandmarkerHolder.shared.clearHandLandmarker()
    self.sendEvent(withName: "onHandLandmarksStatus", body: ["status": "Hand model cleared"])
  }
}

extension HandLandmarks: HandLandmarkerLiveStreamDelegate {
  func handLandmarker(_ handLandmarker: HandLandmarker, didFinishDetection result: HandLandmarkerResult?, timestampInMilliseconds: Int, error: Error?) {
    
    if let error = error {
      self.sendEvent(withName: "onHandLandmarksError", body: ["error": error.localizedDescription])
      return
    }
    
    guard let result = result else {
      return
    }
    
    var handsArray: [[String: Any]] = []
    
    for (handIndex, handLandmarks) in result.landmarks.enumerated() {
      var landmarksArray: [[String: Any]] = []
      
      for (landmarkIndex, landmark) in handLandmarks.enumerated() {
        let landmarkDict: [String: Any] = [
          "index": landmarkIndex,
          "x": landmark.x,
          "y": landmark.y,
          "z": landmark.z,
          "visibility": 1.0
        ]
        landmarksArray.append(landmarkDict)
      }
      
      var handData: [String: Any] = [
        "handIndex": handIndex,
        "landmarks": landmarksArray
      ]
      
      // Add handedness information if available
      if handIndex < result.handedness.count && !result.handedness[handIndex].isEmpty {
        let handedness = result.handedness[handIndex][0]
        handData["label"] = handedness.categoryName
        handData["score"] = handedness.score
      }
      
      handsArray.append(handData)
    }
    
    self.sendEvent(withName: "onHandLandmarksDetected", body: ["hands": handsArray])
  }
}
