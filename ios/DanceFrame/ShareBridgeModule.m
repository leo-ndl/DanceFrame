#import "ShareBridgeModule.h"
#import <Foundation/Foundation.h>

static NSString *const kAppGroupID = @"group.danceframe.shared";
static NSString *const kPendingVideoFilename = @"pending_import.mp4";

@implementation ShareBridgeModule

RCT_EXPORT_MODULE(ShareBridgeModule)

+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_EXPORT_METHOD(getPendingShareVideo:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  NSURL *containerURL = [[NSFileManager defaultManager]
    containerURLForSecurityApplicationGroupIdentifier:kAppGroupID];
  if (!containerURL) {
    resolve([NSNull null]);
    return;
  }

  NSURL *pendingURL = [containerURL URLByAppendingPathComponent:kPendingVideoFilename];
  if (![[NSFileManager defaultManager] fileExistsAtPath:pendingURL.path]) {
    resolve([NSNull null]);
    return;
  }

  // Move (not copy) to a stable temp path — atomically consumes the pending slot
  // so a second JS call or app restart won't re-import the same video.
  NSString *destPath = [NSTemporaryDirectory()
    stringByAppendingPathComponent:
      [NSString stringWithFormat:@"share_import_%@.mp4", [[NSUUID UUID] UUIDString]]];
  NSError *error = nil;
  [[NSFileManager defaultManager] moveItemAtPath:pendingURL.path
                                          toPath:destPath
                                           error:&error];
  if (error) {
    resolve([NSNull null]);
  } else {
    resolve([[NSURL fileURLWithPath:destPath] absoluteString]);
  }
}

@end
