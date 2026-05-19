#if __has_include(<VisionCamera/FrameProcessorPlugin.h>)
#import <VisionCamera/FrameProcessorPlugin.h>
#else
#import "FrameProcessorPlugin.h"
#endif

#if __has_include(<VisionCamera/Frame.h>)
#import <VisionCamera/Frame.h>
#else
#import "Frame.h"
#endif

#import "PoseInferenceModule.h"

@interface PoseFrameProcessorPlugin : FrameProcessorPlugin
@end

@implementation PoseFrameProcessorPlugin

- (id _Nullable)callback:(Frame *)frame withArguments:(NSDictionary *_Nullable)arguments
{
  PoseInferenceModule *module = [PoseInferenceModule sharedInstance];
  if (module == nil) {
    return nil;
  }

  [module processFrame:frame withArguments:arguments];
  return nil;
}

VISION_EXPORT_FRAME_PROCESSOR(PoseFrameProcessorPlugin, poseFrameProcessor)

@end
