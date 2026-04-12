"use client";

import { useParams } from "next/navigation";
import React, { useState, useEffect } from "react";

// Create a context for Station authentication and session information
export const StationContext = React.createContext();

const LEGACY_PROXY_HOST = "proxy.eternityready.com";

/** Recover real stream URL if DB still has the old external proxy (?url=) saved. */
function unwrapLegacyStreamUrl(url) {
  if (!url || typeof url !== "string") return url;
  let current = url.trim();
  for (let n = 0; n < 5; n++) {
    if (!current.toLowerCase().includes(LEGACY_PROXY_HOST)) break;
    try {
      const u = new URL(current);
      const inner = u.searchParams.get("url");
      if (inner) {
        current = inner;
        continue;
      }
    } catch {
      /* fall through */
    }
    const m = current.match(/[?&]url=([^&]+)/);
    if (m) {
      try {
        current = decodeURIComponent(m[1]);
        continue;
      } catch {
        break;
      }
    }
    break;
  }
  return current;
}

function streamProxyUrlForClient(raw) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/stream-proxy?url=${encodeURIComponent(raw)}`;
}

/** Most streams (e.g. Live365/cdnstream) allow direct browser playback with CORS. Only use /api/stream-proxy if you set NEXT_PUBLIC_USE_STREAM_PROXY=true (proxy must be deployed and reachable). */
function playbackStreamUrl(raw) {
  if (process.env.NEXT_PUBLIC_USE_STREAM_PROXY === "true") {
    return streamProxyUrlForClient(raw);
  }
  return raw;
}

// Station provider component to manage Station authentication and session
export const StationProvider = ({ children }) => {
  const [stationsList, setStationsList] = useState([]);
  const [station, setStation] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [upcomingTracks, setUpcomingTracks] = useState([]);
  const [currentPlaying, setCurrentPlaying] = useState({});
  const [loadingStations, setloadingStations] = useState(true);
  const [loadingTracks, setloadingTracks] = useState(true);
  const [loadingUpcomingTracks, setloadingUpcomingTracks] = useState(true);

  const { stationURL } = useParams();

  useEffect(() => {
    const fetchStations = async () => {
      setloadingStations(true);
      try {
        const response = await fetch("/api/station", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        let station_result = data;
        station_result.forEach((station) => {
          let raw = unwrapLegacyStreamUrl(station.url);
          station.originalUrl = raw;
          let out =
            process.env.NEXT_PUBLIC_STREAM_PROXY_DISABLED === "true"
              ? raw
              : playbackStreamUrl(raw);
          if (typeof out === "string" && out.includes(LEGACY_PROXY_HOST)) {
            out = unwrapLegacyStreamUrl(out);
          }
          station.url = out;
        });
        console.log("Stations loaded", station_result);
        setStationsList(station_result);
        setloadingStations(false);
      } catch (error) {
        console.error("Failed to fetch stations", error);
        setloadingStations(false);
      }
    };
    fetchStations();
  }, []);

  const addTrack = (track) => {
    if (track.stationId !== station?.id || !track.metaDataFound) return;
    if (tracks.some((t) => t.trackId == track.trackId)) {
      return;
    }
    setTracks((prevTracks) => {
      let newTracks = [track, ...prevTracks];
      if (newTracks.length > 5) {
        newTracks.pop();
      }
      return newTracks;
    });
  };

  useEffect(() => {
    if (stationsList.length === 0) return;
    let currentStation = null;
    let defaultStation = stationsList.find((station) => station.isDefault);
    if (!defaultStation) {
      defaultStation = stationsList[0];
    }
    let urlStation = stationURL
      ? stationsList.find((station) => station.refUrl === `${stationURL}`)
      : null;
    currentStation = urlStation || defaultStation;
    setStation(currentStation);
  }, [stationsList, stationURL]);

  useEffect(() => {
    if (station && station.id) {
      const fetchTracks = async (stationId) => {
        setloadingTracks(true);
        try {
          const response = await fetch(`/api/station/${stationId}/tracks`);
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to fetch tracks");
          }

          console.log("Last played loaded", data);
          if (data && data.tracks.length > 0) {
            setTracks(data.tracks);
            setloadingTracks(false);
          }

          if (data && data.currentPlaying) {
            setCurrentPlaying(data.currentPlaying);
          }
        } catch (error) {
          console.error("Error fetching tracks:", error);
          setloadingTracks(false);
        }
      };
      fetchTracks(station.id);
    }
  }, [station]);

  useEffect(() => {
    let timeout = null;
    if (station && station.id) {
      const fetchUpcomingTracks = async (stationId) => {
        console.log('stationToLoad', station);
        if (stationId !== station.id) return;
        if (timeout) clearTimeout(timeout);
        try {
          const TIMEOUT_SECONDS = 5 * 60 * 1000;

          if (station.originalUrl.startsWith("https://azura.eternityready.com")) {
            const response = await fetch('https://azura.eternityready.com/api/nowplaying');
            const nowPlaying = await response.json()
            let data;
            if (station.originalUrl == "https://azura.eternityready.com/listen/eternity_ready_radio/radio.mp3") {
              data = nowPlaying[0].playing_next;
            }

            else if (station.originalUrl == "https://azura.eternityready.com/listen/worship_god_radio/radio.mp3") {
              data = nowPlaying[1].playing_next;
            }

            else if (station.originalUrl == "https://azura.eternityready.com/listen/eternity_ready_christmas_station/radio.mp3") {
              data = nowPlaying[2].playing_next;
            }
            data = [{
              id: data.song.id,
              artworkURL: data.song.art,
              groupId: null,
              stationId: 1,
              trackId: null,
              artistId: null,
              trackName: data.song.title,
              artistName: data.song.artist,
              trackViewUrl: null,
              dateScheduled: null,
            }];
            console.log('data', data);
            setUpcomingTracks(data);
            setloadingUpcomingTracks(false);
            return;
          }

          const response = await fetch(
            `/api/station/${stationId}/schedule/upnext`
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to fetch tracks");
          }

          console.log("Upcoming tracks loaded", stationId, data);

          //if (data && data.length > 0) {
            setUpcomingTracks(data);
            let nextTrackTime = new Date(
              data[0].dateScheduled.replace(" ", "T") + "Z"
            ).toLocaleString();

            let now = new Date().toLocaleString();
            let diff = new Date(nextTrackTime) - new Date(now);

            timeout = setTimeout(() => {
              fetchUpcomingTracks(station.id);
            }, diff);
          //}
          setloadingUpcomingTracks(false);

          timeout = setTimeout(() => {
            fetchUpcomingTracks(station.id);
          }, TIMEOUT_SECONDS);
        } catch (error) {
          console.error("Error fetching tracks:", error);
          setloadingUpcomingTracks(false);
        }
      };
      fetchUpcomingTracks(station.id);
    }

    return () => {
      clearTimeout(timeout);
    };
  }, [station]);

  return (
    <StationContext.Provider
      value={{
        station,
        setStation,
        stationsList,
        tracks,
        currentPlaying,
        addTrack,
        loadingStations,
        loadingTracks,
        upcomingTracks,
        loadingUpcomingTracks,
      }}
    >
      {children}
    </StationContext.Provider>
  );
};
