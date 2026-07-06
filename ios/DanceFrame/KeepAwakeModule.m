#import "KeepAwakeModule.h"
#import <UIKit/UIKit.h>

@implementation KeepAwakeModule

RCT_EXPORT_MODULE(DFKeepAwake)

RCT_EXPORT_METHOD(activate) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIApplication sharedApplication].idleTimerDisabled = YES;
  });
}

RCT_EXPORT_METHOD(deactivate) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIApplication sharedApplication].idleTimerDisabled = NO;
  });
}

@end
