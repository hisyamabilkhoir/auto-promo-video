import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export interface RectBox {
  x: number;
  y: number;
  width: number;
  height: number;
  isFixed?: boolean;
}

export interface SceneItem {
  id: string;
  badge: string;
  voiceover: string;
  action: string;
  zoom: number;
  startFrame: number;
  arriveFrame: number;
  endFrame: number;
  nextStartFrame: number;
  targetRect: RectBox;
  interactRect?: RectBox | null;
  afterImageFile?: string | null;
}

export interface PromoProps {
  url: string;
  domain: string;
  pageTitle: string;
  metaDescription: string;
  aspectRatio: '16:9' | '9:16';
  durationPreset: number;
  subtitles: boolean;
  pageWidth: number;
  pageHeight: number;
  viewportHeight: number;
  baseImageFile: string;
  navbarImageFile?: string | null;
  navbarHeight?: number;
  audioFile: string;
  introFrames: number;
  outroFrames: number;
  totalFrames: number;
  scenes: SceneItem[];
}

function clamp(val: number, minVal: number, maxVal: number): number {
  return Math.max(minVal, Math.min(maxVal, val));
}

function getSceneCameraTarget(
  scene: SceneItem,
  pageWidth: number,
  pageHeight: number
) {
  const r = scene.targetRect;
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;

  if (r.isFixed || cy < 110) {
    return {
      scrollY: 0,
      focusX: clamp(cx, 160, pageWidth - 160),
      focusY: clamp(cy, 60, 1020),
      zoom: scene.zoom,
    };
  }

  const maxScroll = Math.max(0, pageHeight - 1080);
  const idealScrollY = clamp(cy - 540, 0, maxScroll);
  const viewY = cy - idealScrollY;

  return {
    scrollY: idealScrollY,
    focusX: clamp(cx, 160, pageWidth - 160),
    focusY: clamp(viewY, 120, 960),
    zoom: scene.zoom,
  };
}

export const PromoComposition: React.FC<PromoProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isPortrait = props.aspectRatio === '9:16';

  const scenes = props.scenes || [];
  const numScenes = scenes.length;

  // Determine active scene index
  let activeIdx = 0;
  for (let i = 0; i < numScenes; i++) {
    if (frame >= scenes[i].startFrame) {
      activeIdx = i;
    }
  }

  const currScene = scenes[activeIdx] || {
    id: 'fallback',
    badge: 'HIGHLIGHT',
    voiceover: '',
    action: 'overview',
    zoom: 1.15,
    startFrame: 0,
    arriveFrame: 48,
    endFrame: 240,
    nextStartFrame: 270,
    targetRect: { x: 400, y: 300, width: 600, height: 200, isFixed: false },
  };
  const prevScene = activeIdx > 0 ? scenes[activeIdx - 1] : currScene;

  const prevCam = getSceneCameraTarget(prevScene, props.pageWidth, props.pageHeight);
  const currCam = getSceneCameraTarget(currScene, props.pageWidth, props.pageHeight);

  // Snappy commercial spring transition from previous scene to current scene
  const moveSpring =
    activeIdx === 0
      ? spring({
          frame: Math.max(0, frame - currScene.startFrame),
          fps,
          config: { damping: 21, stiffness: 115, mass: 0.75 },
        })
      : spring({
          frame: Math.max(0, frame - currScene.startFrame),
          fps,
          config: { damping: 20, stiffness: 128, mass: 0.72 },
        });

  const curScrollY =
    activeIdx === 0
      ? interpolate(moveSpring, [0, 1], [0, currCam.scrollY])
      : interpolate(moveSpring, [0, 1], [prevCam.scrollY, currCam.scrollY]);

  const curFocusX =
    activeIdx === 0
      ? interpolate(moveSpring, [0, 1], [960, currCam.focusX])
      : interpolate(moveSpring, [0, 1], [prevCam.focusX, currCam.focusX]);

  const curFocusY =
    activeIdx === 0
      ? interpolate(moveSpring, [0, 1], [480, currCam.focusY])
      : interpolate(moveSpring, [0, 1], [prevCam.focusY, currCam.focusY]);

  const baseZoom =
    activeIdx === 0
      ? interpolate(moveSpring, [0, 1], [1.0, currCam.zoom])
      : interpolate(moveSpring, [0, 1], [prevCam.zoom, currCam.zoom]);

  // Continuous slow Ken Burns push-in during narration hold
  const kenBurnsDrift = interpolate(
    frame,
    [currScene.arriveFrame, currScene.endFrame],
    [0, 0.055],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Outro pull-back zoom
  const outroStartFrame = props.totalFrames - props.outroFrames;
  const outroSpring = spring({
    frame: Math.max(0, frame - outroStartFrame),
    fps,
    config: { damping: 24, stiffness: 60 },
  });

  const effectiveZoom = interpolate(
    outroSpring,
    [0, 1],
    [baseZoom + kenBurnsDrift, 1.0]
  );

  // Logical viewport dimensions inside the Browser Mockup
  const viewW = isPortrait ? 1080 : 1920;
  const viewH = 1080;

  // Clamped camera translation so the 1920x1080 page ALWAYS fills the viewport edge-to-edge
  const rawTx = viewW / 2 - curFocusX * effectiveZoom;
  const rawTy = viewH / 2 - curFocusY * effectiveZoom;
  const minTx = viewW - 1920 * effectiveZoom;
  const minTy = viewH - 1080 * effectiveZoom;

  const camTx = clamp(rawTx, Math.min(0, minTx), 0);
  const camTy = clamp(rawTy, Math.min(0, minTy), 0);

  // Subtle 3D Studio Window Tilt
  const targetTiltY = ((curFocusX - 960) / 960) * 2.2;
  const targetTiltX = ((540 - curFocusY) / 540) * 1.8;
  const introProgress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 65 },
  });

  const windowScale = interpolate(
    introProgress,
    [0, 1],
    [0.9, 1.0]
  ) * interpolate(outroSpring, [0, 1], [1.0, 0.92]);

  const windowRotX =
    interpolate(introProgress, [0, 1], [8, targetTiltX]) *
    (1 - outroSpring);
  const windowRotY = targetTiltY * (1 - outroSpring);

  // Interactive Click & Cursor Choreography
  const hasInteract = !!currScene.interactRect;
  const interactTriggerFrame = currScene.arriveFrame + 24;
  const interactMoveSpring = spring({
    frame: Math.max(0, frame - (currScene.arriveFrame + 4)),
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  // Cursor position in 1920x1080 viewport space
  const targetViewX = currCam.focusX;
  const targetViewY = currCam.focusY;
  const prevViewX = activeIdx === 0 ? 960 : prevCam.focusX;
  const prevViewY = activeIdx === 0 ? 640 : prevCam.focusY;

  // Bezier arc for main cursor movement
  const tCur = moveSpring;
  const ctrlX = (prevViewX + targetViewX) / 2 - (targetViewY - prevViewY) * 0.15;
  const ctrlY = (prevViewY + targetViewY) / 2 + (targetViewX - prevViewX) * 0.15;
  let cursorVx =
    (1 - tCur) * (1 - tCur) * prevViewX +
    2 * (1 - tCur) * tCur * ctrlX +
    tCur * tCur * targetViewX;
  let cursorVy =
    (1 - tCur) * (1 - tCur) * prevViewY +
    2 * (1 - tCur) * tCur * ctrlY +
    tCur * tCur * targetViewY;

  if (hasInteract && currScene.interactRect) {
    const ir = currScene.interactRect;
    const ix = ir.x + ir.width / 2;
    const iy = (ir.y + ir.height / 2) - curScrollY;
    cursorVx = interpolate(interactMoveSpring, [0, 1], [cursorVx, ix]);
    cursorVy = interpolate(interactMoveSpring, [0, 1], [cursorVy, iy]);
  }

  // Click animation & ripple timing
  const isCtaScene =
    currScene.action === 'highlight_cta' ||
    currScene.action === 'zoom_in' ||
    hasInteract;
  const clickFrame = hasInteract
    ? interactTriggerFrame
    : currScene.arriveFrame + 20;
  const framesSinceClick = frame - clickFrame;

  const cursorClickScale =
    isCtaScene && framesSinceClick >= 0 && framesSinceClick <= 16
      ? interpolate(framesSinceClick, [0, 5, 16], [1, 0.78, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  const rippleProgress =
    isCtaScene && framesSinceClick >= 0 && framesSinceClick <= 36
      ? interpolate(framesSinceClick, [0, 36], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : -1;

  // Crossfade to afterImageFile when interactive slider/tab is clicked
  const afterImageOpacity =
    currScene.afterImageFile && frame >= interactTriggerFrame
      ? interpolate(
          frame,
          [interactTriggerFrame, interactTriggerFrame + 20],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )
      : 0;

  // Spotlight opacity during active scene
  const spotOpacity = interpolate(
    frame,
    [
      currScene.arriveFrame - 12,
      currScene.arriveFrame + 6,
      currScene.endFrame - 6,
      currScene.endFrame + 12,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Intro & Outro Card visibility
  const introOpacity = interpolate(
    frame,
    [0, 14, props.introFrames - 20, props.introFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const introScale = interpolate(
    frame,
    [0, props.introFrames - 20, props.introFrames],
    [0.94, 1.0, 1.08],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const outroOpacity = interpolate(
    frame,
    [outroStartFrame, outroStartFrame + 22],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Subtitle visibility & Word-by-word karaoke calculation
  const subOpacity =
    props.subtitles && currScene.voiceover
      ? interpolate(
          frame,
          [
            currScene.arriveFrame - 6,
            currScene.arriveFrame + 8,
            currScene.endFrame - 4,
            currScene.endFrame + 10,
          ],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )
      : 0;

  const words = (currScene.voiceover || '').trim().split(/\s+/).filter(Boolean);
  const sceneSpeechDuration = Math.max(
    1,
    currScene.endFrame - currScene.arriveFrame
  );
  const activeWordIndex = Math.floor(
    interpolate(
      frame,
      [currScene.arriveFrame, currScene.endFrame - 8],
      [0, words.length - 0.01],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    )
  );

  // Outer Window Frame Sizing
  const mockupWidth = isPortrait ? 990 : 1720;
  const mockupHeaderHeight = 46;
  const mockupBodyHeight = isPortrait ? 990 : 967.5; // 1720 / 1920 * 1080 = 967.5
  const innerScale = isPortrait ? 990 / 1080 : 1720 / 1920;

  const orbOffset1 = Math.sin(frame / 45) * 35;
  const orbOffset2 = Math.cos(frame / 55) * 40;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#050811',
        background:
          'radial-gradient(circle at 18% 18%, #1e3a8a 0%, transparent 48%), radial-gradient(circle at 82% 80%, #4c1d95 0%, transparent 52%), linear-gradient(135deg, #050811 0%, #0f172a 55%, #070b14 100%)',
        fontFamily:
          'system-ui, -apple-system, "Plus Jakarta Sans", "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Master Audio Track */}
      {props.audioFile ? <Audio src={staticFile(props.audioFile)} /> : null}

      {/* Animated Studio Glow Orbs */}
      <div
        style={{
          position: 'absolute',
          top: -120 + orbOffset1,
          left: -100 + orbOffset2,
          width: 650,
          height: 650,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -140 - orbOffset1,
          right: -100 + orbOffset2,
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 70%)',
          filter: 'blur(45px)',
          pointerEvents: 'none',
        }}
      />

      {/* Portrait Mode (9:16 Reels/TikTok) Top Hook Header */}
      {isPortrait && (
        <div
          style={{
            position: 'absolute',
            top: 88,
            left: 45,
            right: 45,
            textAlign: 'center',
            zIndex: 20,
          }}
        >
          <div
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              color: '#ffffff',
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: 1.5,
              padding: '8px 24px',
              borderRadius: 999,
              marginBottom: 16,
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.45)',
              textTransform: 'uppercase',
            }}
          >
            ✨ {currScene.badge}
          </div>
          <div
            style={{
              color: '#ffffff',
              fontSize: 42,
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: -0.5,
              textShadow: '0 6px 24px rgba(0,0,0,0.6)',
            }}
          >
            {props.pageTitle.split('|')[0].trim()}
          </div>
        </div>
      )}

      {/* Center 3D Studio Stage holding the Floating Browser Window */}
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: 1800,
          paddingBottom: isPortrait ? 110 : 18,
          paddingTop: isPortrait ? 60 : 0,
        }}
      >
        <div
          style={{
            width: mockupWidth,
            height: mockupHeaderHeight + mockupBodyHeight,
            borderRadius: 22,
            overflow: 'hidden',
            backgroundColor: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow:
              '0 40px 95px -15px rgba(0, 0, 0, 0.82), 0 0 55px rgba(59, 130, 246, 0.22)',
            transform: `scale(${windowScale}) rotateX(${windowRotX}deg) rotateY(${windowRotY}deg)`,
            transformStyle: 'preserve-3d',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* macOS Safari / Studio Browser Header Bar (Sits ABOVE the page, never overlapping navbar!) */}
          <div
            style={{
              height: mockupHeaderHeight,
              backgroundColor: '#0f172a',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 20px',
              flexShrink: 0,
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: '50%',
                  backgroundColor: '#ff5f56',
                  border: '1px solid #e0443e',
                }}
              />
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: '50%',
                  backgroundColor: '#ffbd2e',
                  border: '1px solid #dea123',
                }}
              />
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: '50%',
                  backgroundColor: '#27c93f',
                  border: '1px solid #1aab29',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 9,
                padding: '5px 24px',
                color: '#e2e8f0',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <span style={{ color: '#10b981', fontSize: 13 }}>🔒</span>
              <span>{props.domain}</span>
            </div>

            <div
              style={{
                color: '#94a3b8',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              {currScene.badge}
            </div>
          </div>

          {/* Browser Viewport Container */}
          <div
            style={{
              width: mockupWidth,
              height: mockupBodyHeight,
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: '#ffffff',
            }}
          >
            {/* Logical Viewport Scaler */}
            <div
              style={{
                width: viewW,
                height: viewH,
                transform: `scale(${innerScale})`,
                transformOrigin: '0 0',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Camera Zoom & Pan Rig */}
              <div
                style={{
                  width: 1920,
                  height: 1080,
                  transform: `translate3d(${camTx}px, ${camTy}px, 0) scale(${effectiveZoom})`,
                  transformOrigin: '0 0',
                  position: 'relative',
                }}
              >
                {/* 1. Scrolling Document Layer */}
                <div
                  style={{
                    width: 1920,
                    height: props.pageHeight,
                    transform: `translate3d(0, ${-curScrollY}px, 0)`,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}
                >
                  <Img
                    src={staticFile(props.baseImageFile)}
                    style={{
                      width: 1920,
                      height: props.pageHeight,
                      display: 'block',
                    }}
                  />

                  {/* Interactive State Image (e.g. Carousel Slid to Next Cards) */}
                  {currScene.afterImageFile && afterImageOpacity > 0 && (
                    <Img
                      src={staticFile(currScene.afterImageFile)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: 1920,
                        height: props.pageHeight,
                        opacity: afterImageOpacity,
                      }}
                    />
                  )}

                  {/* Spotlight Ring on Document Element (Sharp & Non-Blurring!) */}
                  {!currScene.targetRect.isFixed &&
                    currScene.targetRect.y >= 110 &&
                    spotOpacity > 0.01 && (
                      <div
                        style={{
                          position: 'absolute',
                          left: currScene.targetRect.x - 14,
                          top: currScene.targetRect.y - 14,
                          width: currScene.targetRect.width + 28,
                          height: currScene.targetRect.height + 28,
                          borderRadius: 18,
                          border: '3px solid #3b82f6',
                          boxShadow:
                            '0 0 0 6px rgba(59, 130, 246, 0.22), 0 14px 45px rgba(37, 99, 235, 0.45)',
                          opacity: spotOpacity,
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                </div>

                {/* 2. Pinned Sticky Navbar Layer */}
                {props.navbarImageFile && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: 1920,
                      height: props.navbarHeight || 96,
                      zIndex: 5,
                    }}
                  >
                    <Img
                      src={staticFile(props.navbarImageFile)}
                      style={{
                        width: 1920,
                        height: props.navbarHeight || 96,
                        display: 'block',
                      }}
                    />
                    {(currScene.targetRect.isFixed ||
                      currScene.targetRect.y < 110) &&
                      spotOpacity > 0.01 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: currScene.targetRect.x - 10,
                            top: currScene.targetRect.y - 8,
                            width: currScene.targetRect.width + 20,
                            height: currScene.targetRect.height + 16,
                            borderRadius: 14,
                            border: '3px solid #3b82f6',
                            boxShadow:
                              '0 0 0 5px rgba(59, 130, 246, 0.28), 0 8px 30px rgba(37, 99, 235, 0.55)',
                            opacity: spotOpacity,
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                  </div>
                )}

                {/* 3. Click Ripple Wave */}
                {rippleProgress >= 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: cursorVx,
                      top: cursorVy,
                      width: 84,
                      height: 84,
                      borderRadius: '50%',
                      border: '3.5px solid #3b82f6',
                      backgroundColor: 'rgba(59, 130, 246, 0.25)',
                      transform: `translate(-50%, -50%) scale(${interpolate(
                        rippleProgress,
                        [0, 1],
                        [0.3, 2.4]
                      )})`,
                      opacity: interpolate(rippleProgress, [0, 1], [0.95, 0]),
                      zIndex: 15,
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* 4. Crisp High-Res Vector Cursor */}
                <div
                  style={{
                    position: 'absolute',
                    left: cursorVx,
                    top: cursorVy,
                    width: 34,
                    height: 34,
                    transform: `scale(${cursorClickScale})`,
                    transformOrigin: '4px 2px',
                    filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.45))',
                    zIndex: 20,
                    pointerEvents: 'none',
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 2L20 11L13 13L16 20L13 21L10 14L4 19V2Z"
                      fill="#0f172a"
                      stroke="#ffffff"
                      strokeWidth="2.2"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>

      {/* Top-Level Kinetic Word-by-Word Karaoke Subtitles (NEVER blurs or scrolls off!) */}
      {subOpacity > 0.01 && (
        <div
          style={{
            position: 'absolute',
            bottom: isPortrait ? 110 : 34,
            left: '50%',
            transform: `translateX(-50%) translateY(${interpolate(
              subOpacity,
              [0, 1],
              [18, 0]
            )}px)`,
            width: isPortrait ? '90%' : '82%',
            maxWidth: isPortrait ? 960 : 1420,
            textAlign: 'center',
            opacity: subOpacity,
            zIndex: 40,
            pointerEvents: 'none',
          }}
        >
          {!isPortrait && (
            <div style={{ marginBottom: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  padding: '4px 16px',
                  borderRadius: 999,
                  textTransform: 'uppercase',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.45)',
                }}
              >
                ✨ {currScene.badge}
              </span>
            </div>
          )}

          <div
            style={{
              display: 'inline-block',
              backgroundColor: 'rgba(10, 15, 29, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: isPortrait ? 24 : 18,
              padding: isPortrait ? '22px 32px' : '14px 30px',
              boxShadow:
                '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 30px rgba(59, 130, 246, 0.22)',
              lineHeight: 1.45,
            }}
          >
            {words.map((word, wIdx) => {
              const isCurrent = wIdx === activeWordIndex;
              const isPassed = wIdx < activeWordIndex;
              return (
                <span
                  key={wIdx}
                  style={{
                    display: 'inline-block',
                    margin: '0 5px',
                    fontSize: isPortrait ? 33 : 24,
                    fontWeight: isCurrent ? 800 : 600,
                    color: isCurrent
                      ? '#38bdf8'
                      : isPassed
                      ? '#ffffff'
                      : 'rgba(255, 255, 255, 0.45)',
                    transform: isCurrent ? 'scale(1.08) translateY(-2px)' : 'scale(1)',
                    textShadow: isCurrent
                      ? '0 0 18px rgba(56, 189, 248, 0.7)'
                      : 'none',
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 3D Studio Intro Card */}
      {introOpacity > 0.01 && (
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(5, 8, 17, ${introOpacity * 0.78})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            opacity: introOpacity,
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 28,
              padding: isPortrait ? '52px 44px' : '48px 72px',
              maxWidth: isPortrait ? 900 : 1000,
              textAlign: 'center',
              transform: `scale(${introScale})`,
              boxShadow:
                '0 35px 90px rgba(0, 0, 0, 0.75), 0 0 60px rgba(59, 130, 246, 0.35)',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                color: '#ffffff',
                fontSize: isPortrait ? 18 : 13,
                fontWeight: 800,
                letterSpacing: 1.5,
                padding: '6px 20px',
                borderRadius: 999,
                marginBottom: 20,
                textTransform: 'uppercase',
              }}
            >
              ✨ OFFICIAL WEBSITE SHOWCASE
            </div>
            <div
              style={{
                color: '#ffffff',
                fontSize: isPortrait ? 46 : 44,
                fontWeight: 800,
                lineHeight: 1.2,
                marginBottom: 14,
              }}
            >
              {props.pageTitle}
            </div>
            <div
              style={{
                color: '#94a3b8',
                fontSize: isPortrait ? 24 : 20,
                lineHeight: 1.5,
              }}
            >
              {props.metaDescription}
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* 3D Studio Outro CTA Card */}
      {outroOpacity > 0.01 && (
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(5, 8, 17, ${outroOpacity * 0.75})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            opacity: outroOpacity,
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.96)',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              borderRadius: 28,
              padding: isPortrait ? '56px 48px' : '50px 76px',
              maxWidth: isPortrait ? 900 : 960,
              textAlign: 'center',
              transform: `scale(${interpolate(outroOpacity, [0, 1], [0.9, 1])})`,
              boxShadow:
                '0 35px 90px rgba(0, 0, 0, 0.8), 0 0 65px rgba(59, 130, 246, 0.4)',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #10b981, #2563eb)',
                color: '#ffffff',
                fontSize: isPortrait ? 18 : 13,
                fontWeight: 800,
                letterSpacing: 1.5,
                padding: '6px 20px',
                borderRadius: 999,
                marginBottom: 18,
                textTransform: 'uppercase',
              }}
            >
              🎓 PENDAFTARAN RESMI DIBUKA
            </div>
            <div
              style={{
                color: '#ffffff',
                fontSize: isPortrait ? 46 : 42,
                fontWeight: 800,
                lineHeight: 1.2,
                marginBottom: 14,
              }}
            >
              Raih Masa Depan Gemilang Bersama Kami
            </div>
            <div
              style={{
                color: '#cbd5e1',
                fontSize: isPortrait ? 26 : 22,
                marginBottom: 28,
              }}
            >
              🌐 Kunjungi: <strong>{props.domain}</strong>
            </div>
            <div
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                color: '#ffffff',
                fontSize: isPortrait ? 24 : 18,
                fontWeight: 800,
                padding: isPortrait ? '16px 40px' : '14px 36px',
                borderRadius: 14,
                boxShadow: '0 10px 28px rgba(37, 99, 235, 0.5)',
              }}
            >
              Daftar Sekarang &rarr;
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

