#import "ShareBridgeModule.h"
#import <React/RCTLog.h>

@implementation ShareBridgeModule

// This exports the module to React Native as 'ShareBridgeModule'
RCT_EXPORT_MODULE();

// Example native method you can call from JS
RCT_EXPORT_METHOD(shareData:(NSString *)text)
{
  RCTLogInfo(@"Sharing data from native: %@", text);
  // Your native sharing logic will go here
}

@end
