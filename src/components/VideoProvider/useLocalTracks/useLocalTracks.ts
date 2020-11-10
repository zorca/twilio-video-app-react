import backgroundBlur from './backgroundBlur';
import { DEFAULT_VIDEO_CONSTRAINTS, SELECTED_AUDIO_INPUT_KEY, SELECTED_VIDEO_INPUT_KEY } from '../../../constants';
import { useCallback, useState } from 'react';
import Video, { LocalVideoTrack, LocalAudioTrack, CreateLocalTrackOptions } from 'twilio-video';
import { useAudioInputDevices, useVideoInputDevices } from '../../../hooks/deviceHooks/deviceHooks';

export default function useLocalTracks() {
  const [audioTrack, setAudioTrack] = useState<LocalAudioTrack>();
  const [videoTrack, setVideoTrack] = useState<LocalVideoTrack>();
  const [isAcquiringLocalTracks, setIsAcquiringLocalTracks] = useState(false);

  const localAudioDevices = useAudioInputDevices();
  const localVideoDevices = useVideoInputDevices();

  const hasAudio = localAudioDevices.length > 0;
  const hasVideo = localVideoDevices.length > 0;

  const getLocalAudioTrack = useCallback((deviceId?: string) => {
    const options: CreateLocalTrackOptions = {};

    if (deviceId) {
      options.deviceId = { exact: deviceId };
    }

    return Video.createLocalAudioTrack(options).then(newTrack => {
      setAudioTrack(newTrack);
      return newTrack;
    });
  }, []);

  const getLocalVideoTrack = useCallback((newOptions?: CreateLocalTrackOptions) => {
    const options: CreateLocalTrackOptions = {
      ...(DEFAULT_VIDEO_CONSTRAINTS as {}),
      name: `camera-${Date.now()}`,
      ...newOptions,
    };

    return Video.createLocalVideoTrack(options)
      .then(newTrack => {
        return backgroundBlur(newTrack.mediaStreamTrack);
      })
      .then(newMediaStreamTrack => {
        const newTrack = new LocalVideoTrack(newMediaStreamTrack, { name: options.name } as any);
        setVideoTrack(newTrack);
        return newTrack;
      });
  }, []);

  const removeLocalVideoTrack = useCallback(() => {
    if (videoTrack) {
      videoTrack.stop();
      setVideoTrack(undefined);
    }
  }, [videoTrack]);

  const getAudioAndVideoTracks = useCallback(() => {
    if (!hasAudio && !hasVideo) return Promise.resolve();
    if (isAcquiringLocalTracks || audioTrack || videoTrack) return Promise.resolve();

    const videoOptions = {
      ...(DEFAULT_VIDEO_CONSTRAINTS as {}),
      name: `camera-${Date.now()}`,
    };

    setIsAcquiringLocalTracks(true);

    const selectedAudioDeviceId = window.localStorage.getItem(SELECTED_AUDIO_INPUT_KEY);
    const selectedVideoDeviceId = window.localStorage.getItem(SELECTED_VIDEO_INPUT_KEY);

    const hasSelectedAudioDevice = localAudioDevices.some(
      device => selectedAudioDeviceId && device.deviceId === selectedAudioDeviceId
    );
    const hasSelectedVideoDevice = localVideoDevices.some(
      device => selectedVideoDeviceId && device.deviceId === selectedVideoDeviceId
    );

    const localTrackConstraints = {
      video: hasVideo && {
        ...videoOptions,
        ...(hasSelectedVideoDevice && { deviceId: { exact: selectedVideoDeviceId! } }),
      },
      audio: hasSelectedAudioDevice ? { deviceId: { exact: selectedAudioDeviceId! } } : hasAudio,
    };

    return Video.createLocalTracks(localTrackConstraints)
      .then(tracks => {
        const videoTrack = tracks.find(track => track.kind === 'video');
        const audioTrack = tracks.find(track => track.kind === 'audio');
        if (audioTrack) {
          setAudioTrack(audioTrack as LocalAudioTrack);
        }
        if (videoTrack) {
          return backgroundBlur((videoTrack as LocalVideoTrack).mediaStreamTrack).then(newMediaStreamTrack => {
            setVideoTrack(new LocalVideoTrack(newMediaStreamTrack, { name: videoOptions.name } as any));
          });
        }
      })
      .finally(() => setIsAcquiringLocalTracks(false));
  }, [hasAudio, hasVideo, audioTrack, videoTrack, localAudioDevices, localVideoDevices, isAcquiringLocalTracks]);

  const localTracks = [audioTrack, videoTrack].filter(track => track !== undefined) as (
    | LocalAudioTrack
    | LocalVideoTrack
  )[];

  return {
    localTracks,
    getLocalVideoTrack,
    getLocalAudioTrack,
    isAcquiringLocalTracks,
    removeLocalVideoTrack,
    getAudioAndVideoTracks,
  };
}
