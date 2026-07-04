#import "ScreenRecorderModule.h"
#import <ReplayKit/ReplayKit.h>
#import <Photos/Photos.h>

@interface ScreenRecorderModule ()
@property (nonatomic, strong) NSURL *currentOutputURL;
@end

@implementation ScreenRecorderModule

RCT_EXPORT_MODULE(DFScreenRecorder)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_EXPORT_METHOD(isAvailable:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject) {
  BOOL available = RPScreenRecorder.sharedRecorder.isAvailable;
  resolve(@{ @"available": @(available) });
}

RCT_EXPORT_METHOD(startRecording:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    RPScreenRecorder *recorder = RPScreenRecorder.sharedRecorder;

    if (!recorder.isAvailable) {
      reject(@"E_UNAVAILABLE", @"Screen recording is not available on this device", nil);
      return;
    }
    if (recorder.isRecording) {
      resolve(@{ @"started": @YES });
      return;
    }

    // No audio commentary is in scope — keep the mic off so recording never
    // triggers a surprise microphone prompt mid-session.
    recorder.microphoneEnabled = NO;

    NSString *fileName = [NSString stringWithFormat:@"dfrecording-%@.mp4", [NSUUID UUID].UUIDString];
    self.currentOutputURL = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:fileName]];

    [recorder startRecordingWithHandler:^(NSError * _Nullable error) {
      if (error) {
        reject(@"E_START_FAILED", error.localizedDescription, error);
        return;
      }
      resolve(@{ @"started": @YES });
    }];
  });
}

RCT_EXPORT_METHOD(stopRecording:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    RPScreenRecorder *recorder = RPScreenRecorder.sharedRecorder;

    if (!recorder.isRecording) {
      resolve(@{ @"saved": @NO });
      return;
    }

    NSURL *outputURL = self.currentOutputURL;
    if (!outputURL) {
      resolve(@{ @"saved": @NO, @"error": @"Missing output file" });
      return;
    }

    [recorder stopRecordingWithOutputURL:outputURL completionHandler:^(NSError * _Nullable error) {
      if (error) {
        resolve(@{ @"saved": @NO, @"error": error.localizedDescription });
        return;
      }
      [self saveFileToPhotos:outputURL completion:^(BOOL saved, NSString * _Nullable errorMessage) {
        if (saved) {
          resolve(@{ @"saved": @YES });
        } else {
          resolve(@{ @"saved": @NO, @"error": errorMessage ?: @"Unknown error saving to Photos" });
        }
      }];
    }];
  });
}

- (void)saveFileToPhotos:(NSURL *)fileURL completion:(void (^)(BOOL saved, NSString * _Nullable errorMessage))completion {
  void (^performSave)(void) = ^{
    [[PHPhotoLibrary sharedPhotoLibrary] performChanges:^{
      [PHAssetChangeRequest creationRequestForAssetFromVideoAtFileURL:fileURL];
    } completionHandler:^(BOOL success, NSError * _Nullable error) {
      if (success) {
        [[NSFileManager defaultManager] removeItemAtURL:fileURL error:nil];
      }
      dispatch_async(dispatch_get_main_queue(), ^{
        completion(success, error.localizedDescription);
      });
    }];
  };

  PHAuthorizationStatus status = [PHPhotoLibrary authorizationStatusForAccessLevel:PHAccessLevelAddOnly];
  if (status == PHAuthorizationStatusAuthorized || status == PHAuthorizationStatusLimited) {
    performSave();
    return;
  }

  [PHPhotoLibrary requestAuthorizationForAccessLevel:PHAccessLevelAddOnly handler:^(PHAuthorizationStatus newStatus) {
    if (newStatus == PHAuthorizationStatusAuthorized || newStatus == PHAuthorizationStatusLimited) {
      performSave();
    } else {
      dispatch_async(dispatch_get_main_queue(), ^{
        completion(NO, @"Photos access denied");
      });
    }
  }];
}

@end
