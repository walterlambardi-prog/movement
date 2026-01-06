#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

#if __has_include("handLandmarks/handLandmarks-Swift.h")
#import "handLandmarks/handLandmarks-Swift.h"
#else
#import "movement-Swift.h"
#endif

VISION_EXPORT_SWIFT_FRAME_PROCESSOR(HandLandmarksFrameProcessorPlugin, handLandmarks)
