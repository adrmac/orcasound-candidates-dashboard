import "videojs-offset";

import { Box, Slider, Typography } from "@mui/material";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";

import { useNowPlaying } from "@/context/NowPlayingContext";

import { type PlayerStatus } from "./Player";
import PlayPauseButton from "./PlayPauseButton";
import { type VideoJSPlayer } from "./VideoJS";

// dynamically import VideoJS to speed up initial page load

const VideoJS = dynamic(() => import("./VideoJS"));

export function PlaybarAIPlayer({
  clipDateTime,
  clipNode,
  // feed,
  image,
  marks,
  // timestamp,
  // startOffset,
  // endOffset,
  audioUri,
  onAudioPlay,
  // changeListState,
  // index,
  // command,
  onPlayerInit,
  onPlay,
  // onPlayerEnd,
}: {
  clipDateTime?: string;
  clipNode?: string;
  // feed: Pick<Feed, "nodeName" | "bucket">;
  image?: string | undefined;
  marks?: { label: string; value: number }[];
  // timestamp: number;
  // startOffset: number;
  // endOffset: number;
  audioUri: string;
  onAudioPlay?: () => void;
  // changeListState?: (value: number, status: string) => void;
  // index?: number;
  // command?: string;
  onPlayerInit?: (player: VideoJSPlayer) => void;
  onPlay?: () => void;
  // onPlayerEnd?: () => void;
}) {
  // const lgUp = useMediaQuery((theme: Theme) => theme.breakpoints.up("lg"));

  // special to the AI player
  const startOffset = 0;

  const { masterPlayerRef, setMasterPlayerStatus, onPlayerEnd } =
    useNowPlaying();
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("idle");
  const playerRef = useRef<VideoJSPlayer | null>(null);
  const [playerTime, setPlayerTime] = useState(startOffset);

  // special to the AI player
  const [endOffset, setEndOffset] = useState(58);

  // const sliderMax = endOffset - startOffset;
  // const sliderValue = playerTime - startOffset;

  // const hlsURI = getHlsURI(feed.bucket, feed.nodeName, timestamp);

  const playerOptions = useMemo(
    () => ({
      autoplay: false,
      // flash: {
      //   hls: {
      //     overrideNative: true,
      //   },
      // },
      // html5: {
      //   hls: {
      //     overrideNative: true,
      //   },
      // },
      sources: [
        {
          // If hlsURI isn't set, use a dummy URI to trigger an error
          // The dummy URI doesn't actually exist, it should return 404
          // This is the only way to get videojs to throw an error, otherwise
          // it just won't initialize (if src is undefined/null/empty))
          src: audioUri,
          type: "audio/wav",
          // type: "application/x-mpegurl",
        },
      ],
    }),
    [audioUri],
  );

  const handleReady = useCallback(
    (player: VideoJSPlayer) => {
      playerRef.current = player;
      // auto-play the player when it mounts -- mounting is triggered in Playbar based on nowPlaying
      if (playerRef.current) {
        masterPlayerRef.current = playerRef.current;
        player.play();
      }

      if (onPlayerInit) onPlayerInit(player);
      player.on("playing", () => {
        setPlayerStatus("playing");
        setMasterPlayerStatus("playing");
        // const currentTime = player.currentTime() ?? 0;
        // if (currentTime < startOffset || currentTime > endOffset) {
        //   player.currentTime(startOffset);
        //   setPlayerTime(endOffset);
        // }
        // (changeListState && index) && changeListState(index, "playing");
        if (onPlay) onPlay();
      });
      player.on("pause", () => {
        setPlayerStatus("paused");
        setMasterPlayerStatus("paused");
        // (changeListState && index) && changeListState(index, "paused");
      });
      player.on("waiting", () => {
        setPlayerStatus("loading");
        setMasterPlayerStatus("loading");
      });
      player.on("error", () => {
        setPlayerStatus("error");
        setMasterPlayerStatus("error");
      });
      player.on("timeupdate", () => {
        const currentTime = player.currentTime() ?? 0;
        if (currentTime >= endOffset) {
          player.currentTime(startOffset);
          setPlayerTime(startOffset);
          player.pause();
          if (onPlayerEnd) onPlayerEnd();
        } else {
          setPlayerTime(currentTime);
        }
      });
      player.on("loadedmetadata", () => {
        // special to the AI player
        const duration = player.duration() || 0;
        setEndOffset(duration);
        // On initial load, set player time to startOffset
        player.currentTime(startOffset);
      });
    },
    [
      startOffset,
      endOffset,
      onPlay,
      onPlayerEnd,
      onPlayerInit,
      masterPlayerRef,
      setMasterPlayerStatus,
    ],
  );

  const handlePlayPauseClick = () => {
    const player = playerRef.current;

    if (playerStatus === "error") {
      setPlayerStatus("idle");
      setMasterPlayerStatus("idle");
      return;
    }

    if (!player) {
      setPlayerStatus("error");
      setMasterPlayerStatus("error");
      return;
    }

    try {
      if (playerStatus === "loading" || playerStatus === "playing") {
        player.pause();
      } else {
        player.play();
        onAudioPlay?.();
      }
    } catch (e) {
      console.error(e);
      // AbortError is thrown if pause() is called while play() is still loading (e.g. if segments are 404ing)
      // It's not important, so don't show this error to the user
      if (e instanceof DOMException && e.name === "AbortError") return;
      setPlayerStatus("error");
      setMasterPlayerStatus("error");
    }
  };

  // useEffect(() => {
  //   if (process.env.NODE_ENV === "development" && hlsURI) {
  //     console.log(`New stream instance: ${hlsURI}`);
  //   }
  //   return () => {
  //     setPlayerStatus("idle");
  //   };
  // }, [hlsURI, feed.nodeName]);

  const handleSliderChange = (
    _e: Event,
    v: number | number[],
    _activeThumb: number,
  ) => {
    playerRef?.current?.pause();
    if (typeof v !== "number") return;
    playerRef?.current?.currentTime(v + startOffset);
  };

  const handleSliderChangeCommitted = (
    _e: Event | React.SyntheticEvent<Element, Event>,
    v: number | number[],
  ) => {
    if (typeof v !== "number") return;
    playerRef?.current?.currentTime(v + startOffset);
    playerRef?.current?.play();
  };

  return (
    <Box
      sx={(theme) => ({
        minHeight: theme.spacing(10),
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: [0, 2],
        position: "relative",
        // Keep player above the sliding drawer
        zIndex: theme.zIndex.drawer + 1,
        width: "100%",
      })}
    >
      <Box display="none" id="video-js">
        <VideoJS options={playerOptions} onReady={handleReady} />
      </Box>
      <Box ml={0} mr={3} id="play-pause-button">
        <PlayPauseButton
          playerStatus={playerStatus}
          onClick={handlePlayPauseClick}
          disabled={!audioUri}
        />
      </Box>
      <Box
        mr={4}
        sx={{
          backgroundImage: `url(${image})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          width: "105px",
          height: "60px",
          borderRadius: "4px",
        }}
      ></Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          paddingRight: "2em",
        }}
      >
        <Box width={"100%"} id="slider">
          <Typography component="h2">
            <span style={{ fontWeight: "bold" }}>{clipDateTime}</span> •{" "}
            {clipNode}
          </Typography>
          <Slider
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v + startOffset.toFixed(2)} s`}
            step={0.1}
            max={endOffset - startOffset}
            // max={sliderMax}
            value={playerTime - startOffset}
            // value={sliderValue}
            marks={marks}
            onChange={handleSliderChange}
            onChangeCommitted={handleSliderChangeCommitted}
            size="small"
          />
        </Box>

        <Box
          id="formatted-seconds"
          sx={{ display: "flex", justifyContent: "space-between" }}
        >
          <Typography component="p" variant="subtitle2">
            {formattedSeconds(Number((playerTime - startOffset).toFixed(0)))}
          </Typography>
          <Typography component="p" variant="subtitle2">
            {"-" +
              formattedSeconds(Number((endOffset - playerTime).toFixed(0)))}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

const formattedSeconds = (seconds: number) => {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${Number(mm).toString().padStart(2, "0")}:${ss
    .toFixed(0)
    .padStart(2, "0")}`;
};
