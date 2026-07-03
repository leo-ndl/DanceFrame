#import "VideoProcessorModule.h"

#import <AVFoundation/AVFoundation.h>
#import <CoreImage/CoreImage.h>
#import <Photos/Photos.h>
#import <PhotosUI/PhotosUI.h>
#import <UIKit/UIKit.h>

#if __has_include(<MLKitPoseDetectionCommon/MLKitPoseDetectionCommon.h>)
#import <MLKitPoseDetectionCommon/MLKitPoseDetectionCommon.h>
#endif
#if __has_include(<MLKitPoseDetection/MLKitPoseDetection.h>)
#import <MLKitPoseDetection/MLKitPoseDetection.h>
#endif
#if __has_include(<MLKitVision/MLKitVision.h>)
#import <MLKitVision/MLKitVision.h>
#endif

static NSString *const kExtractionProgressEvent = @"onVideoExtractionProgress";
static const double kMaxVideoDurationSec = 90.0;

// Same keypoint order as PoseInferenceModule so indices align.
static NSArray<NSDictionary<NSString *, NSString *> *> *VideoKeypointMappings(void) {
  static NSArray<NSDictionary<NSString *, NSString *> *> *mappings = nil;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    mappings = @[
      @{@"name": @"nose",          @"type": MLKPoseLandmarkTypeNose},
      @{@"name": @"leftEye",       @"type": MLKPoseLandmarkTypeLeftEye},
      @{@"name": @"rightEye",      @"type": MLKPoseLandmarkTypeRightEye},
      @{@"name": @"leftEar",       @"type": MLKPoseLandmarkTypeLeftEar},
      @{@"name": @"rightEar",      @"type": MLKPoseLandmarkTypeRightEar},
      @{@"name": @"leftShoulder",  @"type": MLKPoseLandmarkTypeLeftShoulder},
      @{@"name": @"rightShoulder", @"type": MLKPoseLandmarkTypeRightShoulder},
      @{@"name": @"leftElbow",     @"type": MLKPoseLandmarkTypeLeftElbow},
      @{@"name": @"rightElbow",    @"type": MLKPoseLandmarkTypeRightElbow},
      @{@"name": @"leftWrist",     @"type": MLKPoseLandmarkTypeLeftWrist},
      @{@"name": @"rightWrist",    @"type": MLKPoseLandmarkTypeRightWrist},
      @{@"name": @"leftHip",       @"type": MLKPoseLandmarkTypeLeftHip},
      @{@"name": @"rightHip",      @"type": MLKPoseLandmarkTypeRightHip},
      @{@"name": @"leftKnee",      @"type": MLKPoseLandmarkTypeLeftKnee},
      @{@"name": @"rightKnee",     @"type": MLKPoseLandmarkTypeRightKnee},
      @{@"name": @"leftAnkle",     @"type": MLKPoseLandmarkTypeLeftAnkle},
      @{@"name": @"rightAnkle",    @"type": MLKPoseLandmarkTypeRightAnkle},
    ];
  });
  return mappings;
}

@interface VideoProcessorModule () <PHPickerViewControllerDelegate>
@property (nonatomic, assign) BOOL hasListeners;
@property (nonatomic, copy, nullable) RCTPromiseResolveBlock pendingPickResolve;
@property (nonatomic, copy, nullable) RCTPromiseRejectBlock pendingPickReject;
@property (nonatomic, strong, nullable) MLKPoseDetector *poseDetector;
@end

@implementation VideoProcessorModule

RCT_EXPORT_MODULE(VideoProcessorModule)

+ (BOOL)requiresMainQueueSetup { return NO; }

- (NSArray<NSString *> *)supportedEvents {
  return @[kExtractionProgressEvent];
}

- (void)startObserving { self.hasListeners = YES; }
- (void)stopObserving  { self.hasListeners = NO; }

// MARK: – pickVideo

RCT_REMAP_METHOD(pickVideo,
  pickVideoWithResolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (self.pendingPickResolve != nil) {
    reject(@"E_PICKER_BUSY", @"Another picker is already open", nil);
    return;
  }

  self.pendingPickResolve = resolve;
  self.pendingPickReject  = reject;

  dispatch_async(dispatch_get_main_queue(), ^{
    PHPickerConfiguration *config = [[PHPickerConfiguration alloc] init];
    config.filter = [PHPickerFilter videosFilter];
    config.selectionLimit = 1;

    PHPickerViewController *picker = [[PHPickerViewController alloc] initWithConfiguration:config];
    picker.delegate = self;

    UIViewController *root = [UIApplication sharedApplication].keyWindow.rootViewController;
    while (root.presentedViewController) root = root.presentedViewController;
    [root presentViewController:picker animated:YES completion:nil];
  });
}

- (void)picker:(PHPickerViewController *)picker didFinishPicking:(NSArray<PHPickerResult *> *)results {
  [picker dismissViewControllerAnimated:YES completion:nil];

  RCTPromiseResolveBlock resolve = self.pendingPickResolve;
  RCTPromiseRejectBlock  reject  = self.pendingPickReject;
  self.pendingPickResolve = nil;
  self.pendingPickReject  = nil;

  if (results.count == 0 || resolve == nil) {
    if (reject) reject(@"E_PICKER_CANCELLED", @"User cancelled video picker", nil);
    return;
  }

  PHPickerResult *result = results.firstObject;
  NSItemProvider *provider = result.itemProvider;

  if (![provider hasItemConformingToTypeIdentifier:@"public.movie"]) {
    reject(@"E_INVALID_TYPE", @"Selected item is not a video", nil);
    return;
  }

  [provider loadFileRepresentationForTypeIdentifier:@"public.movie" completionHandler:^(NSURL *url, NSError *error) {
    if (error || url == nil) {
      reject(@"E_LOAD_FAILED", error.localizedDescription ?: @"Failed to load video file", nil);
      return;
    }

    // Copy to a temp location that persists after the block.
    NSURL *tempDir = [NSURL fileURLWithPath:NSTemporaryDirectory()];
    NSURL *destURL = [tempDir URLByAppendingPathComponent:url.lastPathComponent];
    NSError *copyError = nil;
    [[NSFileManager defaultManager] removeItemAtURL:destURL error:nil];
    [[NSFileManager defaultManager] copyItemAtURL:url toURL:destURL error:&copyError];
    if (copyError) {
      reject(@"E_COPY_FAILED", copyError.localizedDescription, nil);
      return;
    }

    resolve(destURL.absoluteString);
  }];
}

// MARK: – persistVideo

RCT_REMAP_METHOD(persistVideo,
  persistVideo:(NSString *)videoUriString
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSURL *srcURL = [NSURL URLWithString:videoUriString];
    if (srcURL == nil) {
      reject(@"E_INVALID_URI", @"Invalid video URI", nil);
      return;
    }

    NSError *dirError = nil;
    NSURL *appSupportURL = [[NSFileManager defaultManager] URLForDirectory:NSApplicationSupportDirectory
                                                                    inDomain:NSUserDomainMask
                                                           appropriateForURL:nil
                                                                      create:YES
                                                                       error:&dirError];
    if (dirError) {
      reject(@"E_PERSIST_FAILED", dirError.localizedDescription, nil);
      return;
    }

    NSURL *videosDir = [appSupportURL URLByAppendingPathComponent:@"ImportedVideos" isDirectory:YES];
    [[NSFileManager defaultManager] createDirectoryAtURL:videosDir withIntermediateDirectories:YES attributes:nil error:&dirError];
    if (dirError) {
      reject(@"E_PERSIST_FAILED", dirError.localizedDescription, nil);
      return;
    }

    NSString *ext = srcURL.pathExtension.length > 0 ? srcURL.pathExtension : @"mp4";
    NSString *filename = [NSString stringWithFormat:@"%@.%@", [[NSUUID UUID] UUIDString], ext];
    NSURL *destURL = [videosDir URLByAppendingPathComponent:filename];

    NSError *copyError = nil;
    [[NSFileManager defaultManager] copyItemAtURL:srcURL toURL:destURL error:&copyError];
    if (copyError) {
      reject(@"E_COPY_FAILED", copyError.localizedDescription, nil);
      return;
    }

    resolve(destURL.absoluteString);
  });
}

// MARK: – extractPosesFromVideo

RCT_REMAP_METHOD(extractPosesFromVideo,
  extractPosesFromVideo:(NSString *)videoUriString
  options:(NSDictionary *)options
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    @try {
      NSURL *videoURL = [NSURL URLWithString:videoUriString];
      if (videoURL == nil) {
        reject(@"E_INVALID_URI", @"Invalid video URI", nil);
        return;
      }

      AVAsset *asset = [AVAsset assetWithURL:videoURL];
      CMTime duration = asset.duration;
      double durationSec = CMTimeGetSeconds(duration);
      if (durationSec <= 0.0) {
        reject(@"E_INVALID_VIDEO", @"Could not read video duration", nil);
        return;
      }
      if (durationSec > kMaxVideoDurationSec) {
        reject(@"E_DURATION_EXCEEDED",
               [NSString stringWithFormat:@"Video exceeds maximum duration of %.0f seconds", kMaxVideoDurationSec],
               nil);
        return;
      }

      // Determine frame interval in ms (default 200ms = 5fps).
      NSNumber *intervalMsValue = options[@"frameIntervalMs"];
      double intervalMs = [intervalMsValue isKindOfClass:[NSNumber class]] ? intervalMsValue.doubleValue : 200.0;
      intervalMs = MAX(50.0, MIN(1000.0, intervalMs));

      // Cap at 500 frames to limit memory.
      NSInteger maxFrames = 500;
      NSNumber *maxFramesValue = options[@"maxFrames"];
      if ([maxFramesValue isKindOfClass:[NSNumber class]]) maxFrames = maxFramesValue.integerValue;

      double intervalSec = intervalMs / 1000.0;
      NSInteger totalFrames = (NSInteger)MIN((double)maxFrames, ceil(durationSec / intervalSec));

      // Set up image generator.
      AVAssetImageGenerator *generator = [AVAssetImageGenerator assetImageGeneratorWithAsset:asset];
      generator.appliesPreferredTrackTransform = YES;
      generator.maximumSize = CGSizeMake(480, 480);
      generator.requestedTimeToleranceBefore = CMTimeMakeWithSeconds(intervalSec * 0.5, 600);
      generator.requestedTimeToleranceAfter  = CMTimeMakeWithSeconds(intervalSec * 0.5, 600);

      // Set up ML Kit detector.
      MLKPoseDetectorOptions *detectorOptions = [[MLKPoseDetectorOptions alloc] init];
      detectorOptions.detectorMode = MLKPoseDetectorModeSingleImage;
      MLKPoseDetector *detector = [MLKPoseDetector poseDetectorWithOptions:detectorOptions];

      NSMutableArray *poses = [NSMutableArray arrayWithCapacity:totalFrames];
      NSArray<NSDictionary<NSString *, NSString *> *> *mappings = VideoKeypointMappings();
      NSInteger processed = 0;

      for (NSInteger i = 0; i < totalFrames; i++) {
        double timeSec = i * intervalSec;
        CMTime frameTime = CMTimeMakeWithSeconds(timeSec, 600);

        NSError *imgError = nil;
        CGImageRef cgImage = [generator copyCGImageAtTime:frameTime actualTime:nil error:&imgError];
        if (cgImage == nil || imgError != nil) continue;

        UIImage *image = [UIImage imageWithCGImage:cgImage];
        CGImageRelease(cgImage);

        MLKVisionImage *visionImage = [[MLKVisionImage alloc] initWithImage:image];
        NSError *poseError = nil;
        NSArray<MLKPose *> *detectedPoses = [detector resultsInImage:visionImage error:&poseError];

        if (detectedPoses.count > 0) {
          MLKPose *pose = detectedPoses.firstObject;
          CGFloat frameWidth = image.size.width * image.scale;
          CGFloat frameHeight = image.size.height * image.scale;
          NSDictionary *posePayload = [self buildPosePayload:pose
                                                  frameWidth:frameWidth
                                                 frameHeight:frameHeight
                                                 timestampMs:timeSec * 1000.0
                                                    mappings:mappings];
          if (posePayload) [poses addObject:posePayload];
        }

        processed++;
        if (self.hasListeners && (processed % 5 == 0 || processed == totalFrames)) {
          double percent = (double)processed / (double)totalFrames * 100.0;
          [self sendEventWithName:kExtractionProgressEvent
                             body:@{@"current": @(processed), @"total": @(totalFrames), @"percent": @(percent)}];
        }
      }

      resolve(@{@"poses": poses, @"durationMs": @(durationSec * 1000.0), @"totalFrames": @(processed)});
    } @catch (NSException *e) {
      reject(@"E_EXTRACTION_FAILED", e.reason ?: @"Video pose extraction failed", nil);
    }
  });
}

- (nullable NSDictionary *)buildPosePayload:(MLKPose *)pose
                                 frameWidth:(CGFloat)frameWidth
                                frameHeight:(CGFloat)frameHeight
                                timestampMs:(double)timestampMs
                                   mappings:(NSArray<NSDictionary<NSString *, NSString *> *> *)mappings
{
  NSMutableArray *keypoints = [NSMutableArray arrayWithCapacity:mappings.count];
  double confidenceSum = 0.0;
  NSInteger confidentCount = 0;

  for (NSDictionary<NSString *, NSString *> *mapping in mappings) {
    MLKPoseLandmarkType keypointType = mapping[@"type"];
    MLKPoseLandmark *landmark = [pose landmarkOfType:keypointType];

    double x = 0.0, y = 0.0, confidence = 0.0;
    if (landmark && frameWidth > 0 && frameHeight > 0) {
      x = MIN(MAX(landmark.position.x / frameWidth, 0.0), 1.0);
      y = MIN(MAX(landmark.position.y / frameHeight, 0.0), 1.0);
      confidence = MIN(MAX(landmark.inFrameLikelihood, 0.0), 1.0);
    }

    if (confidence >= 0.3) { confidenceSum += confidence; confidentCount++; }

    [keypoints addObject:@{
      @"name": mapping[@"name"] ?: @"",
      @"x": @(x), @"y": @(y), @"confidence": @(confidence),
    }];
  }

  if (confidentCount == 0) return nil;

  return @{
    @"keypoints":   keypoints,
    @"timestamp":   @(timestampMs),
    @"confidence":  @(confidenceSum / confidentCount),
    @"frameWidth":  @((NSInteger)frameWidth),
    @"frameHeight": @((NSInteger)frameHeight),
  };
}

// MARK: – extractAudioEnvelope

RCT_REMAP_METHOD(extractAudioEnvelope,
  extractAudioEnvelope:(NSString *)videoUriString
  options:(NSDictionary *)options
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    @try {
      NSURL *videoURL = [NSURL URLWithString:videoUriString];
      if (videoURL == nil) {
        reject(@"E_INVALID_URI", @"Invalid video URI", nil);
        return;
      }

      AVAsset *asset = [AVAsset assetWithURL:videoURL];
      CMTime duration = asset.duration;
      double durationSec = CMTimeGetSeconds(duration);
      if (durationSec <= 0.0) {
        reject(@"E_INVALID_VIDEO", @"Could not read video duration", nil);
        return;
      }
      if (durationSec > kMaxVideoDurationSec) {
        reject(@"E_DURATION_EXCEEDED",
               [NSString stringWithFormat:@"Video exceeds maximum duration of %.0f seconds", kMaxVideoDurationSec],
               nil);
        return;
      }

      AVAssetTrack *audioTrack = [[asset tracksWithMediaType:AVMediaTypeAudio] firstObject];
      if (audioTrack == nil) {
        reject(@"E_NO_AUDIO_TRACK", @"This video has no audio track", nil);
        return;
      }

      // Window size in ms for RMS energy computation (default 25ms).
      NSNumber *windowMsValue = options[@"windowMs"];
      double windowMs = [windowMsValue isKindOfClass:[NSNumber class]] ? windowMsValue.doubleValue : 25.0;
      windowMs = MAX(10.0, MIN(200.0, windowMs));

      const double sampleRate = 44100.0;
      NSDictionary *outputSettings = @{
        AVFormatIDKey: @(kAudioFormatLinearPCM),
        AVLinearPCMIsFloatKey: @YES,
        AVLinearPCMBitDepthKey: @32,
        AVLinearPCMIsNonInterleaved: @NO,
        AVNumberOfChannelsKey: @1,
        AVSampleRateKey: @(sampleRate),
      };

      NSError *readerError = nil;
      AVAssetReader *reader = [[AVAssetReader alloc] initWithAsset:asset error:&readerError];
      if (readerError || reader == nil) {
        reject(@"E_AUDIO_EXTRACTION_FAILED", readerError.localizedDescription ?: @"Failed to open audio reader", nil);
        return;
      }

      AVAssetReaderTrackOutput *output = [[AVAssetReaderTrackOutput alloc] initWithTrack:audioTrack
                                                                           outputSettings:outputSettings];
      if (![reader canAddOutput:output]) {
        reject(@"E_AUDIO_EXTRACTION_FAILED", @"Cannot add audio track output", nil);
        return;
      }
      [reader addOutput:output];

      if (![reader startReading]) {
        reject(@"E_AUDIO_EXTRACTION_FAILED", reader.error.localizedDescription ?: @"Failed to start audio reading", nil);
        return;
      }

      // Accumulate PCM samples into fixed-size windows and compute RMS energy
      // per window — a cheap, FFT-free onset-detection input (broadband
      // energy envelope). No spectral analysis needed for strong-beat detection.
      NSMutableArray<NSNumber *> *envelope = [NSMutableArray array];
      NSUInteger samplesPerWindow = (NSUInteger)MAX(1.0, round(sampleRate * (windowMs / 1000.0)));
      double windowSumSquares = 0.0;
      NSUInteger windowSampleCount = 0;

      CMSampleBufferRef sampleBuffer;
      while ((sampleBuffer = [output copyNextSampleBuffer])) {
        CMBlockBufferRef blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer);
        if (blockBuffer) {
          size_t lengthAtOffset = 0;
          size_t totalLength = 0;
          char *dataPointer = NULL;
          if (CMBlockBufferGetDataPointer(blockBuffer, 0, &lengthAtOffset, &totalLength, &dataPointer) == kCMBlockBufferNoErr
              && dataPointer != NULL) {
            const float *samples = (const float *)dataPointer;
            NSUInteger sampleCount = totalLength / sizeof(float);
            for (NSUInteger i = 0; i < sampleCount; i++) {
              float s = samples[i];
              windowSumSquares += (double)s * (double)s;
              windowSampleCount++;
              if (windowSampleCount >= samplesPerWindow) {
                double rms = sqrt(windowSumSquares / (double)windowSampleCount);
                [envelope addObject:@(rms)];
                windowSumSquares = 0.0;
                windowSampleCount = 0;
              }
            }
          }
        }
        CFRelease(sampleBuffer);
      }

      // Flush any partial trailing window.
      if (windowSampleCount > 0) {
        double rms = sqrt(windowSumSquares / (double)windowSampleCount);
        [envelope addObject:@(rms)];
      }

      if (reader.status == AVAssetReaderStatusFailed) {
        reject(@"E_AUDIO_EXTRACTION_FAILED", reader.error.localizedDescription ?: @"Audio extraction failed", nil);
        return;
      }

      resolve(@{@"envelope": envelope, @"windowMs": @(windowMs), @"durationMs": @(durationSec * 1000.0)});
    } @catch (NSException *e) {
      reject(@"E_AUDIO_EXTRACTION_FAILED", e.reason ?: @"Audio envelope extraction failed", nil);
    }
  });
}

@end
