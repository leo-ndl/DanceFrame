#import "PoseInferenceModule.h"
#if __has_include(<VisionCamera/Frame.h>)
#import <VisionCamera/Frame.h>
#else
#import "Frame.h"
#endif

#if __has_include(<MLKitPoseDetectionCommon/MLKitPoseDetectionCommon.h>)
#import <MLKitPoseDetectionCommon/MLKitPoseDetectionCommon.h>
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
#import <QuartzCore/CAShapeLayer.h>
#import <React/RCTViewManager.h>
#import <math.h>

static NSString *const kPoseEventName = @"onPose";
static NSString *const kPoseErrorEventName = @"onPoseError";
static NSString *const kPoseStateEventName = @"onPoseState";
static PoseInferenceModule *gSharedPoseModule = nil;

static NSArray<NSDictionary<NSString *, NSString *> *> *PoseKeypointMappings(void) {
  static NSArray<NSDictionary<NSString *, NSString *> *> *mappings = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    mappings = @[
      @{@"name" : @"nose", @"type" : MLKPoseLandmarkTypeNose},
      @{@"name" : @"leftEye", @"type" : MLKPoseLandmarkTypeLeftEye},
      @{@"name" : @"rightEye", @"type" : MLKPoseLandmarkTypeRightEye},
      @{@"name" : @"leftEar", @"type" : MLKPoseLandmarkTypeLeftEar},
      @{@"name" : @"rightEar", @"type" : MLKPoseLandmarkTypeRightEar},
      @{@"name" : @"leftShoulder", @"type" : MLKPoseLandmarkTypeLeftShoulder},
      @{@"name" : @"rightShoulder", @"type" : MLKPoseLandmarkTypeRightShoulder},
      @{@"name" : @"leftElbow", @"type" : MLKPoseLandmarkTypeLeftElbow},
      @{@"name" : @"rightElbow", @"type" : MLKPoseLandmarkTypeRightElbow},
      @{@"name" : @"leftWrist", @"type" : MLKPoseLandmarkTypeLeftWrist},
      @{@"name" : @"rightWrist", @"type" : MLKPoseLandmarkTypeRightWrist},
      @{@"name" : @"leftHip", @"type" : MLKPoseLandmarkTypeLeftHip},
      @{@"name" : @"rightHip", @"type" : MLKPoseLandmarkTypeRightHip},
      @{@"name" : @"leftKnee", @"type" : MLKPoseLandmarkTypeLeftKnee},
      @{@"name" : @"rightKnee", @"type" : MLKPoseLandmarkTypeRightKnee},
      @{@"name" : @"leftAnkle", @"type" : MLKPoseLandmarkTypeLeftAnkle},
      @{@"name" : @"rightAnkle", @"type" : MLKPoseLandmarkTypeRightAnkle},
    ];
  });
  return mappings;
}

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

@class DFPoseOverlayView;

@interface DFPoseOverlayRegistry : NSObject
+ (instancetype)shared;
+ (void)registerView:(DFPoseOverlayView *)view;
+ (void)unregisterView:(DFPoseOverlayView *)view;
+ (void)publishPosePayload:(nullable NSDictionary *)payload;
@end

@interface DFPoseOverlayView : UIView
@property(nonatomic, assign, getter=isEnabled) BOOL enabled;
@property(nonatomic, assign, getter=isMirrored) BOOL mirrored;
- (void)applyPosePayload:(nullable NSDictionary *)payload;
@end

// Keypoint index pairs forming the body skeleton (matches PoseKeypointMappings order).
static const NSInteger kSkeletonConnections[][2] = {
  {0, 1}, {0, 2},         // nose → eyes
  {1, 3}, {2, 4},         // eyes → ears
  {5, 6},                 // shoulder to shoulder
  {5, 7}, {7, 9},         // left arm
  {6, 8}, {8, 10},        // right arm
  {5, 11}, {6, 12},       // torso sides
  {11, 12},               // hips
  {11, 13}, {13, 15},     // left leg
  {12, 14}, {14, 16},     // right leg
};
static const NSInteger kSkeletonConnectionCount = 16;

@implementation DFPoseOverlayView {
  CAShapeLayer *_linesLayer;
  CAShapeLayer *_pointsLayer;
  NSDictionary *_lastPayload;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  self = [super initWithFrame:frame];
  if (self) {
    _enabled = YES;
    _mirrored = NO;
    self.backgroundColor = UIColor.clearColor;

    _linesLayer = [CAShapeLayer layer];
    _linesLayer.strokeColor = [UIColor colorWithRed:0.239 green:0.808 blue:0.400 alpha:0.7].CGColor;
    _linesLayer.fillColor = UIColor.clearColor.CGColor;
    _linesLayer.lineWidth = 2.5;
    _linesLayer.lineCap = kCALineCapRound;
    [self.layer addSublayer:_linesLayer];

    _pointsLayer = [CAShapeLayer layer];
    _pointsLayer.fillColor = [UIColor colorWithRed:0.239 green:0.808 blue:0.400 alpha:0.95].CGColor;
    [self.layer addSublayer:_pointsLayer];
  }
  return self;
}

- (void)dealloc
{
  [DFPoseOverlayRegistry unregisterView:self];
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (self.window != nil) {
    [DFPoseOverlayRegistry registerView:self];
  } else {
    [DFPoseOverlayRegistry unregisterView:self];
  }
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  _linesLayer.frame = self.bounds;
  _pointsLayer.frame = self.bounds;
  [self redraw];
}

- (void)setEnabled:(BOOL)enabled
{
  if (_enabled == enabled) {
    return;
  }
  _enabled = enabled;
  [self redraw];
}

- (void)setMirrored:(BOOL)mirrored
{
  if (_mirrored == mirrored) {
    return;
  }
  _mirrored = mirrored;
  [self redraw];
}

- (void)applyPosePayload:(nullable NSDictionary *)payload
{
  _lastPayload = [payload copy];
  [self redraw];
}

- (void)redraw
{
  if (!self.isEnabled || _lastPayload == nil || self.bounds.size.width <= 0.0 || self.bounds.size.height <= 0.0) {
    _linesLayer.path = nil;
    _pointsLayer.path = nil;
    return;
  }

  NSArray *keypoints = _lastPayload[@"keypoints"];
  if (![keypoints isKindOfClass:[NSArray class]] || keypoints.count == 0) {
    _linesLayer.path = nil;
    _pointsLayer.path = nil;
    return;
  }

  CGFloat sourceWidth = [_lastPayload[@"frameWidth"] doubleValue];
  CGFloat sourceHeight = [_lastPayload[@"frameHeight"] doubleValue];
  if (sourceWidth <= 0.0 || sourceHeight <= 0.0) {
    _linesLayer.path = nil;
    _pointsLayer.path = nil;
    return;
  }

  CGFloat viewWidth = self.bounds.size.width;
  CGFloat viewHeight = self.bounds.size.height;
  CGFloat coverScale = MAX(viewWidth / sourceWidth, viewHeight / sourceHeight);
  CGFloat scaledWidth = sourceWidth * coverScale;
  CGFloat scaledHeight = sourceHeight * coverScale;
  CGFloat offsetX = (viewWidth - scaledWidth) * 0.5;
  CGFloat offsetY = (viewHeight - scaledHeight) * 0.5;

  // Pre-compute screen positions for all 17 keypoints.
  const NSInteger kMaxKeypoints = 17;
  NSInteger count = (NSInteger)MIN(keypoints.count, (NSUInteger)kMaxKeypoints);
  CGPoint positions[kMaxKeypoints];
  BOOL visible[kMaxKeypoints];
  for (NSInteger i = 0; i < kMaxKeypoints; i++) {
    visible[i] = NO;
    positions[i] = CGPointZero;
  }

  for (NSInteger i = 0; i < count; i++) {
    NSDictionary *keypoint = keypoints[(NSUInteger)i];
    if (![keypoint isKindOfClass:[NSDictionary class]]) continue;
    NSNumber *confidenceValue = keypoint[@"confidence"];
    CGFloat confidence = [confidenceValue isKindOfClass:[NSNumber class]] ? confidenceValue.doubleValue : 0.0;
    if (confidence <= 0.0) continue;
    NSNumber *xValue = keypoint[@"x"];
    NSNumber *yValue = keypoint[@"y"];
    if (![xValue isKindOfClass:[NSNumber class]] || ![yValue isKindOfClass:[NSNumber class]]) continue;
    CGFloat sourceX = MIN(MAX(xValue.doubleValue, 0.0), 1.0) * sourceWidth;
    CGFloat sourceY = MIN(MAX(yValue.doubleValue, 0.0), 1.0) * sourceHeight;
    if (self.isMirrored) sourceX = sourceWidth - sourceX;
    positions[i] = CGPointMake(offsetX + sourceX * coverScale, offsetY + sourceY * coverScale);
    visible[i] = YES;
  }

  // Draw skeleton lines between connected joint pairs.
  UIBezierPath *linesPath = [UIBezierPath bezierPath];
  for (NSInteger c = 0; c < kSkeletonConnectionCount; c++) {
    NSInteger a = kSkeletonConnections[c][0];
    NSInteger b = kSkeletonConnections[c][1];
    if (a >= count || b >= count || !visible[a] || !visible[b]) continue;
    [linesPath moveToPoint:positions[a]];
    [linesPath addLineToPoint:positions[b]];
  }
  _linesLayer.path = linesPath.CGPath;

  // Draw keypoint circles on top of lines.
  UIBezierPath *pointsPath = [UIBezierPath bezierPath];
  const CGFloat radius = 4.0;
  for (NSInteger i = 0; i < count; i++) {
    if (!visible[i]) continue;
    [pointsPath appendPath:[UIBezierPath bezierPathWithArcCenter:positions[i]
                                                          radius:radius
                                                      startAngle:0
                                                        endAngle:(CGFloat)(M_PI * 2.0)
                                                       clockwise:YES]];
  }
  _pointsLayer.path = pointsPath.CGPath;
}

@end

@implementation DFPoseOverlayRegistry {
  NSHashTable<DFPoseOverlayView *> *_views;
  NSDictionary *_lastPayload;
}

+ (instancetype)shared
{
  static DFPoseOverlayRegistry *registry;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    registry = [[DFPoseOverlayRegistry alloc] init];
  });
  return registry;
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    _views = [NSHashTable weakObjectsHashTable];
  }
  return self;
}

+ (void)registerView:(DFPoseOverlayView *)view
{
  dispatch_async(dispatch_get_main_queue(), ^{
    DFPoseOverlayRegistry *registry = [DFPoseOverlayRegistry shared];
    [registry->_views addObject:view];
    [view applyPosePayload:registry->_lastPayload];
  });
}

+ (void)unregisterView:(DFPoseOverlayView *)view
{
  dispatch_async(dispatch_get_main_queue(), ^{
    DFPoseOverlayRegistry *registry = [DFPoseOverlayRegistry shared];
    [registry->_views removeObject:view];
  });
}

+ (void)publishPosePayload:(nullable NSDictionary *)payload
{
  dispatch_async(dispatch_get_main_queue(), ^{
    DFPoseOverlayRegistry *registry = [DFPoseOverlayRegistry shared];
    registry->_lastPayload = [payload copy];
    for (DFPoseOverlayView *view in registry->_views) {
      [view applyPosePayload:payload];
    }
  });
}

@end

@interface PoseOverlayViewManager : RCTViewManager
@end

@implementation PoseOverlayViewManager

RCT_EXPORT_MODULE(PoseOverlayView)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (UIView *)view
{
  return [[DFPoseOverlayView alloc] initWithFrame:CGRectZero];
}

RCT_EXPORT_VIEW_PROPERTY(enabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(mirrored, BOOL)

@end

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
  [DFPoseOverlayRegistry publishPosePayload:nil];
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
    [DFPoseOverlayRegistry publishPosePayload:nil];
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
  [DFPoseOverlayRegistry publishPosePayload:nil];
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
      [DFPoseOverlayRegistry publishPosePayload:nil];
      [self emitErrorThrottledWithCode:@"E_FRAME_PROCESS" message:error.localizedDescription];
      return;
    }
    if (poses.count == 0) {
      [DFPoseOverlayRegistry publishPosePayload:nil];
      return;
    }

    NSDictionary *payload =
        [self buildPosePayloadFromPose:poses.firstObject
                             frameWidth:frame.width
                            frameHeight:frame.height
                              timestamp:timestampMs
                              arguments:arguments];
    if (payload == nil) {
      [DFPoseOverlayRegistry publishPosePayload:nil];
      return;
    }

    self.lastProcessedTimestampMs = timestampMs;
    [DFPoseOverlayRegistry publishPosePayload:payload];
    [self emitPose:payload];
  } @catch (NSException *exception) {
    [DFPoseOverlayRegistry publishPosePayload:nil];
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

  NSArray<NSDictionary<NSString *, NSString *> *> *mappings = PoseKeypointMappings();
  NSMutableArray *keypoints = [NSMutableArray arrayWithCapacity:mappings.count];
  double confidenceSum = 0.0;
  NSInteger confidentCount = 0;

  for (NSDictionary<NSString *, NSString *> *mapping in mappings) {
    NSString *keypointName = mapping[@"name"];
    MLKPoseLandmarkType keypointType = mapping[@"type"];
    MLKPoseLandmark *landmark = [pose landmarkOfType:keypointType];

    double x = 0.0;
    double y = 0.0;
    double confidence = 0.0;
    if (landmark != nil && frameWidth > 0 && frameHeight > 0) {
      MLKVision3DPoint *point = landmark.position;
      x = clamp01(point.x / (double)frameWidth);
      y = clamp01(point.y / (double)frameHeight);
      confidence = clamp01(landmark.inFrameLikelihood + confidenceBias);
    }

    if (confidence >= self.minKeypointConfidence) {
      confidenceSum += confidence;
      confidentCount += 1;
    }

    [keypoints addObject:@{
      @"name" : keypointName ?: @"",
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
