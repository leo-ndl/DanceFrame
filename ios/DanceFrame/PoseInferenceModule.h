#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@class Frame;

@interface PoseInferenceModule : RCTEventEmitter <RCTBridgeModule>

+ (nullable PoseInferenceModule*)sharedInstance;
- (void)processFrame:(Frame*)frame withArguments:(nullable NSDictionary*)arguments;

@end
