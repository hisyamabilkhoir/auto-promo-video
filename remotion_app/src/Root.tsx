import React from 'react';
import { Composition } from 'remotion';
import { PromoComposition, PromoProps } from './PromoComposition';

const defaultProps: PromoProps = {
  url: 'https://school.abynsstudio.com/',
  domain: 'school.abynsstudio.com',
  pageTitle: 'SMA Negeri 1 Nusantara',
  metaDescription: 'Membentuk Generasi Cerdas, Berkarakter, dan Berdaya Saing',
  aspectRatio: '16:9',
  durationPreset: 45,
  subtitles: true,
  pageWidth: 1920,
  pageHeight: 8000,
  viewportHeight: 1080,
  baseImageFile: 'page_base.png',
  navbarImageFile: 'navbar.png',
  navbarHeight: 96,
  audioFile: 'master_audio.wav',
  introFrames: 108,
  outroFrames: 120,
  totalFrames: 2700,
  scenes: [],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoVideo"
        component={PromoComposition as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={2700}
        fps={60}
        width={1920}
        height={1080}
        defaultProps={defaultProps as unknown as Record<string, unknown>}
        calculateMetadata={({ props }) => {
          const typedProps = props as unknown as PromoProps;
          const isPortrait = typedProps.aspectRatio === '9:16';
          return {
            durationInFrames: Math.max(120, Number(typedProps.totalFrames) || 2700),
            fps: 60,
            width: isPortrait ? 1080 : 1920,
            height: isPortrait ? 1920 : 1080,
          };
        }}
      />
    </>
  );
};

