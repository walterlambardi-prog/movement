//
//  HandLandmarkerHolder.swift
//  movement
//

import Foundation
import MediaPipeTasksVision

class HandLandmarkerHolder {
  static let shared = HandLandmarkerHolder()
  
  private(set) var handLandmarker: HandLandmarker?
  
  private init() {}
  
  func initializeHandLandmarker(with options: HandLandmarkerOptions) throws {
    self.handLandmarker = try HandLandmarker(options: options)
  }
  
  func clearHandLandmarker() {
    self.handLandmarker = nil
  }
  
  func getHandLandmarker() -> HandLandmarker? {
    return self.handLandmarker
  }
}
