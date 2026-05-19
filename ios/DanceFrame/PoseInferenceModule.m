#import "PoseInferenceModule.h"
#if __has_include(<VisionCamera/Frame.h>)
#import <VisionCamera/Frame.h>
#else
#import "Frame.h"
#endif

#if __has_include(<MLKitPoseDetection/MLKitPoseDetection.h>)
#import <MLKitPoseDetection/MLKitPoseDetection.h>
#endif
#if __has_include(<MLKitPoseDetectionAccurate/MLKitPoseDetectionAccurate.h>)
#import <MLKitPoseDetectionAccurate/MLKitPoseDetectionAccurate.h>
#endif
#if __has_include(<MLKitVision/MLKitVision.h>)
#import <MLKitVision/MLKitVision.h>
#endif

#import <CoreMedia/CoreMedia.h>
#import <CoreVideo/CoreVideo.h>
#import <math.h>

static NSString *const kPoseEventName = @"onPose";
static NSString *const kPoseErrorEventName = @"onPoseError";
static NSString *const kPoseStateEventName = @"onPoseState";
static PoseInferenceModule *gSharedPoseModule = nil;

typedef struct PoseKeypointMapping {
  const char *name;
  MLKPoseLandmarkType type;
} PoseKeypointMapping;

static const PoseKeypointMapping kKeypointMappings[] = {
  {"nose", MLKPoseLandmarkTypeNose},
  {"leftEye", MLKPoseLandmarkTypeLeftEye},
  {"rightEye", MLKPoseLandmarkTypeRightEye},
  {"leftEar", MLKPoseLandmarkTypeLeftEar},
  {"rightEar", MLKPoseLandmarkTypeRightEar},
  {"leftShoulder", MLKPoseLandmarkTypeLeftShoulder},
  {"rightShoulder", MLKPoseLandmarkTypeRightShoulder},
  {"leftElbow", MLKPoseLandmarkTypeLeftElbow},
  {"rightElbow", MLKPoseLandmarkTypeRightElbow},
  {"leftWrist", MLKPoseLandmarkTypeLeftWrist},
  {"rightWrist", MLKPoseLandmarkTypeRightWrist},
  {"leftHip", MLKPoseLandmarkTypeLeftHip},
  {"rightHip", MLKPoseLandmarkTypeRightHip},
  {"leftKnee", MLKPoseLandmarkTypeLeftKnee},
  {"rightKnee", MLKPoseLandmarkTypeRightKnee},
  {"leftAnkle", MLKPoseLandmarkTypeLeftAnkle},
  {"rightAnkle", MLKPoseLandmarkTypeRightAnkle},
};

static inline double clamp01(double value) {
  if (value < 0.0) return 0.0;
  if (value > 1.0) return 1.0;
  return value;
}

static inline double normalizeTimestampToMs(double rawTimestamp) {
  if (rawTimestamp <= 0.0) return 0.0;

  // Handle common timestamp units from camera/frame APIs.
  if (rawTimestamp > 1.0e14) return rawTimestamp / 1.0e6; // ns
  if (rawTimestamp > 1.0e11) return rawTimestamp / 1.0e3; // us
  if (rawTimestamp > 1.0e8) return rawTimestamp;          // already ms
  return rawTimestamp * 1000.0;                           // seconds
}

@interface PoseInferenceModule ()

@property(nonatomic, assign) BOOL hasListeners;
@property(nonatomic, assign) BOOL isInitialized;
@property(nonatomic, assign) BOOL isRunning;
@property(nonatomic, assign) double minKeypointConfidence;
@property(nonatomic, assign) NSInteger targetFps;
@property(nonatomic, assign) double minFrameIntervalMs;
@property(nonatomic, assign) double lastProcessedTimestampMs;
@property(nonatomic, assign) double lastAttemptTimestampMs;
@property(nonatomic, assign) double lastErrorEmitTimestampMs;
@property(nonatomic, copy) NSString *selectedModelType;
@property(nonatomic, strong, nullable) MLKPoseDetector *poseDetector;

@end

@implementation PoseInferenceModule

RCT_EXPORT_MODULE(PoseInferenceModule)

+ (PoseInferenceModule *)sharedInstance
{
  return gSharedPoseModule;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    _minKeypointConfidence = 0.3;
    _targetFps = 30;
    _minFrameIntervalMs = 1000.0 / 30.0;
    _lastProcessedTimestampMs = 0.0;
    _lastAttemptTimestampMs = 0.0;
    _lastErrorEmitTimestampMs = 0.0;
    _selectedModelType = @"lightning";
    gSharedPoseModule = self;
  }
  return self;
}

- (void)dealloc
{
  if (gSharedPoseModule == self) {
    gSharedPoseModule = nil;
  }
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ kPoseEventName, kPoseErrorEventName, kPoseStateEventName ];
}

- (NSDictionary *)constantsToExport
{
  return @{
    @"EVENT_POSE" : kPoseEventName,
    @"EVENT_ERROR" : kPoseErrorEventName,
    @"EVENT_STATE" : kPoseStateEventName,
  };
}

- (void)startObserving
{
  self.hasListeners = YES;
}

- (void)stopObserving
{
  self.hasListeners = NO;
}

RCT_REMAP_METHOD(
  initialize,
  initialize:(NSDictionary *)options
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    NSNumber *targetFps = options[@"targetFps"];
    if ([targetFps isKindOfClass:[NSNumber class]]) {
      NSInteger fps = MAX(5, MIN(60, targetFps.integerValue));
      self.targetFps = fps;
      self.minFrameIntervalMs = 1000.0 / (double)fps;
    } else {
      self.targetFps = 30;
      self.minFrameIntervalMs = 1000.0 / 30.0;
    }

    NSNumber *minConfidence = options[@"minKeypointConfidence"];
    if ([minConfidence isKindOfClass:[NSNumber class]]) {
      self.minKeypointConfidence = MAX(0.05, MIN(1.0, minConfidence.doubleValue));
    } else {
      self.minKeypointConfidence = 0.3;
    }

    NSString *modelType = options[@"modelType"];
    self.selectedModelType = [modelType isKindOfClass:[NSString class]] && [modelType.lowercaseString isEqualToString:@"thunder"]
        ? @"thunder"
        : @"lightning";

    self.poseDetector = [self createPoseDetectorForModelType:self.selectedModelType];
    self.lastProcessedTimestampMs = 0.0;
    self.lastAttemptTimestampMs = 0.0;
    self.isInitialized = YES;
    self.isRunning = NO;
    [self emitState];
    resolve(@(YES));
  } @catch (NSException *exception) {
    NSString *message = exception.reason ?: @"Failed to initialize pose inference";
    [self emitErrorWithCode:@"E_INITIALIZE" message:message];
    reject(@"E_INITIALIZE", message, nil);
  }
}

RCT_REMAP_METHOD(start, startWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  if (!self.isInitialized) {
    reject(@"E_NOT_INITIALIZED", @"PoseInferenceModule not initialized. Call initialize() first.", nil);
    return;
  }

  self.isRunning = YES;
  [self emitState];
  resolve(nil);
}

RCT_REMAP_METHOD(stop, stopWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  self.isRunning = NO;
  [self emitState];
  resolve(nil);
}

- (void)processFrame:(Frame *)frame withArguments:(NSDictionary *)arguments
{
  @try {
    if (!self.isInitialized || !self.isRunning) {
      return;
    }

    if ([NSThread isMainThread]) {
      return;
    }

    MLKPoseDetector *detector = self.poseDetector;
    if (detector == nil) {
      return;
    }

    double timestampMs = normalizeTimestampToMs(frame.timestamp);
    if ((timestampMs - self.lastAttemptTimestampMs) < self.minFrameIntervalMs) {
      return;
    }
    self.lastAttemptTimestampMs = timestampMs;

    MLKVisionImage *visionImage = [[MLKVisionImage alloc] initWithBuffer:frame.buffer];
    visionImage.orientation = frame.orientation;

    NSError *error = nil;
    NSArray<MLKPose *> *poses = [detector resultsInImage:visionImage error:&error];
    if (error != nil) {
      [self emitErrorThrottledWithCode:@"E_FRAME_PROCESS" message:error.localizedDescription];
      return;
    }
    if (poses.count == 0) {
      return;
    }

    NSDictionary *payload =
        [self buildPosePayloadFromPose:poses.firstObject
                             frameWidth:frame.width
                            frameHeight:frame.height
                              timestamp:timestampMs
                              arguments:arguments];
    if (payload == nil) {
      return;
    }

    self.lastProcessedTimestampMs = timestampMs;
    [self emitPose:payload];
  } @catch (NSException *exception) {
    NSString *message = exception.reason ?: @"Failed to process camera frame";
    [self emitErrorThrottledWithCode:@"E_FRAME_PROCESS" message:message];
  }
}

- (MLKPoseDetector *)createPoseDetectorForModelType:(NSString *)modelType
{
  if ([modelType isEqualToString:@"thunder"]) {
    MLKAccuratePoseDetectorOptions *accurateOptions = [[MLKAccuratePoseDetectorOptions alloc] init];
    accurateOptions.detectorMode = MLKPoseDetectorModeStream;
    return [MLKPoseDetector poseDetectorWithOptions:accurateOptions];
  }

  MLKPoseDetectorOptions *baseOptions = [[MLKPoseDetectorOptions alloc] init];
  baseOptions.detectorMode = MLKPoseDetectorModeStream;
  return [MLKPoseDetector poseDetectorWithOptions:baseOptions];
}

- (nullable NSDictionary *)buildPosePayloadFromPose:(MLKPose *)pose
                                         frameWidth:(size_t)frameWidth
                                        frameHeight:(size_t)frameHeight
                                          timestamp:(double)timestampMs
                                          arguments:(NSDictionary *)arguments
{
  NSNumber *confidenceBiasValue = arguments[@"confidenceBias"];
  double confidenceBias = [confidenceBiasValue isKindOfClass:[NSNumber class]] ? confidenceBiasValue.doubleValue : 0.0;

  NSMutableArray *keypoints = [NSMutableArray arrayWithCapacity:(sizeof(kKeypointMappings) / sizeof(kKeypointMappings[0]))];
  double confidenceSum = 0.0;
  NSInteger confidentCount = 0;

  for (int i = 0; i < (int)(sizeof(kKeypointMappings) / sizeof(kKeypointMappings[0])); i++) {
    PoseKeypointMapping mapping = kKeypointMappings[i];
    MLKPoseLandmark *landmark = [pose landmarkOfType:mapping.type];

    double x = 0.0;
    double y = 0.0;
    double confidence = 0.0;
    if (landmark != nil && frameWidth > 0 && frameHeight > 0) {
      CGPoint point = landmark.position;
      x = clamp01(point.x / (double)frameWidth);
      y = clamp01(point.y / (double)frameHeight);
      confidence = clamp01(landmark.inFrameLikelihood + confidenceBias);
    }

    if (confidence >= self.minKeypointConfidence) {
      confidenceSum += confidence;
      confidentCount += 1;
    }

    [keypoints addObject:@{
      @"name" : [NSString stringWithUTF8String:mapping.name],
      @"x" : @(x),
      @"y" : @(y),
      @"confidence" : @(confidence),
    }];
  }

  if (confidentCount <= 0) {
    return nil;
  }
  double overallConfidence = confidenceSum / (double)confidentCount;

  return @{
    @"keypoints" : keypoints,
    @"timestamp" : @(timestampMs),
    @"confidence" : @(overallConfidence),
    @"frameWidth" : @((NSInteger)frameWidth),
    @"frameHeight" : @((NSInteger)frameHeight),
  };
}

- (void)emitPose:(NSDictionary *)payload
{
  if (!self.hasListeners || !self.isInitialized || !self.isRunning) {
    return;
  }
  [self sendEventWithName:kPoseEventName body:payload];
}

- (void)emitErrorWithCode:(NSString *)code message:(NSString *)message
{
  if (!self.hasListeners) {
    return;
  }
  [self sendEventWithName:kPoseErrorEventName
                     body:@{
                       @"code" : code ?: @"E_UNKNOWN",
                       @"message" : message ?: @"Unknown pose inference error",
                     }];
}

- (void)emitErrorThrottledWithCode:(NSString *)code message:(NSString *)message
{
  NSTimeInterval nowMs = [[NSDate date] timeIntervalSince1970] * 1000.0;
  if ((nowMs - self.lastErrorEmitTimestampMs) < 1000.0) {
    return;
  }
  self.lastErrorEmitTimestampMs = nowMs;
  [self emitErrorWithCode:code message:message];
}

- (void)emitState
{
  if (!self.hasListeners) {
    return;
  }
  [self sendEventWithName:kPoseStateEventName
                     body:@{
                       @"isInitialized" : @(self.isInitialized),
                       @"isRunning" : @(self.isRunning),
                     }];
}

@end
