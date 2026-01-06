#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(HandLandmarks, RCTEventEmitter)

RCT_EXTERN_METHOD(initModel)
RCT_EXTERN_METHOD(clearModel)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
