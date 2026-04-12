"use client";
import React, {useContext, useEffect, useRef, useState} from "react";
import {StationContext} from "./station";
import IcecastMetadataStats from "icecast-metadata-stats";
import {getTrack, processSongInfo} from "@/lib/utils";
//import process from "next/dist/build/webpack/loaders/resolve-url-loader/lib/postcss";

const DEFAULT_TRACK = {
    stationId: null,
    trackId: null,
    artistId: null,
    StreamTitle: "",
    trackName: "",
    artistName: "",
    artworkURL: "/track-bg-default.webp",
    artistImage: "/artist-bg-default.webp",
    trackViewUrl: "#",
    loaded: false,
    processed: false,
    metaDataFound: false,
};

// Create a context for Player authentication and session information
export const PlayerContext = React.createContext();

// Player provider component to manage Player authentication and session
export const PlayerProvider = ({ children }) => {
    const { station, currentPlaying, addTrack } = useContext(StationContext);
    const [player, setPlayer] = useState({
        play: () => {},
        stop: () => {},
        setVolume: () => {},
        switchEndpoint: () => {},
    });
    const [playerIsLoaded, setPlayerIsLoaded] = useState(false);
    const playerIsLoadedRef = useRef(false);
    useEffect(() => {
        playerIsLoadedRef.current = playerIsLoaded;
    }, [playerIsLoaded]);
    const playerVolumeRef = useRef(1);
    useEffect(() => {
        playerVolumeRef.current = playerVolume;
    }, [playerVolume]);
    const activeIcecastRef = useRef(null);
    const statsListenerRef = useRef(null);
    const [playerState, setPlayerState] = useState("stopped");
    const [playerVolume, setPlayerVolume] = useState(1);
    const [currentTrack, setCurrentTrack] = useState(DEFAULT_TRACK);
    const [initalTrackLoaded, setInitalTrackLoaded] = useState(false);
    const changeVolume = (volume) => {
        setPlayerVolume(volume);
        player.setVolume(volume);
    };

    const [listeners, setListeners] = useState(null);
    useEffect(() => {
        async function fetchListeners() {
            try {
                const response = await fetch("/api/stream-proxy/listeners");
                if (!response.ok) return;
                const result = await response.json();
                if (result) setListeners(result);
            } catch {
                /* optional endpoint */
            }
        }
        fetchListeners();
    }, [currentPlaying])

// Initialize player with current playing track
    useEffect(() => {
        if (!initalTrackLoaded) {
            const defaultTrackData = {
                ...DEFAULT_TRACK,
                loaded: true,
                processed: false,
            };
            const updatedTrack = currentPlaying.title ? {
                ...defaultTrackData,
                StreamTitle: currentPlaying.title,
                stationId: currentPlaying.stationId,
                artworkURL: currentPlaying.artworkURL || station?.thumbnail,
                trackName: currentPlaying.trackName,
                artistName: currentPlaying.artistName,
                artistImage: currentPlaying.artistImage || station?.thumbnail,
                metaDataFound: true,
            } : station ? {
                ...defaultTrackData,
                trackName: station.metaPreset,
                artworkURL: station.thumbnail,
                artistImage: station.thumbnail,
                metaDataFound: false,
            } : currentTrack;

            setInitalTrackLoaded(true);
            setCurrentTrack(updatedTrack);
        }
    }, [currentPlaying, initalTrackLoaded, station]);

// Initialize Icecast player — must rebuild when station changes (was gated by playerInitialized and never updated URL).
    useEffect(() => {
        if (!station?.url) {
            return;
        }

        let cancelled = false;

        const initializePlayer = async () => {
            const { default: IcecastMetadataPlayer } = await import(
                "icecast-metadata-player"
            );
            if (cancelled) return;

            const sid = station.id;
            const thumb = station.thumbnail;

            const options = {
                lastPlayedMetadata: true,
                metadataTypes: ["icy", "ogg"],
                onMetadata: (metadata) => {
                    setCurrentTrack((prevState) => {
                        if (metadata.StreamTitle === prevState.StreamTitle) {
                            return {
                                ...prevState,
                                StreamTitle: metadata.StreamTitle,
                            };
                        }
                        return {
                            ...DEFAULT_TRACK,
                            StreamTitle: metadata.StreamTitle,
                            stationId: sid,
                            artworkURL: thumb,
                        };
                    });
                },
                onError: (error) => {
                    console.error("ERROR", error);
                },
            };

            const playerLisner = new IcecastMetadataPlayer(station.url, {
                ...options,
            });

            if (cancelled) {
                playerLisner.stop();
                return;
            }

            activeIcecastRef.current = playerLisner;

            setPlayer({
                play: async () => {
                    setPlayerState("loading");
                    await playerLisner.play();
                    setPlayerState("playing");
                },
                stop: async () => {
                    await playerLisner.stop();
                    setPlayerState("stopped");
                },
                setVolume: (volume) => {
                    playerLisner.audioElement.volume = volume;
                },
                switchEndpoint: async () => {
                    const inst = activeIcecastRef.current;
                    if (inst) {
                        await inst.stop();
                        if (typeof inst.detachAudioElement === "function") {
                            await inst.detachAudioElement();
                        }
                    }
                    setPlayerIsLoaded(true);
                    setPlayerState("stopped");
                },
            });

            if (playerIsLoadedRef.current) {
                setPlayerState("loading");
                await playerLisner.play();
                playerLisner.audioElement.volume = playerVolumeRef.current;
                setPlayerState("playing");
            }
        };

        initializePlayer();

        return () => {
            cancelled = true;
            const inst = activeIcecastRef.current;
            activeIcecastRef.current = null;
            if (inst) {
                try {
                    inst.stop();
                } catch {
                    /* ignore */
                }
            }
        };
    }, [station?.id, station?.url]);

// Update player volume
    useEffect(() => {
        const inst = activeIcecastRef.current;
        if (inst?.audioElement) {
            inst.audioElement.volume = playerVolume;
        }
    }, [playerVolume]);

// Fetch additional metadata for the current track
    useEffect(() => {
        if (currentTrack.stationId !== null && !currentTrack.loaded) {
            async function fetchMetadata() {
                await getAdditionalMetadata(currentTrack);
            }
            fetchMetadata();
        }
    }, [currentTrack]);

// Add current track to the track list
    useEffect(() => {
        if (currentTrack.processed) {
            addTrack(currentTrack);
        }
    }, [currentTrack]);

// Fetch Icecast stats (when not playing — avoids duplicating metadata with the live player)
    useEffect(() => {
        if (!station?.url || playerState === "playing") {
            return;
        }

        const sid = station.id;
        const thumb = station.thumbnail;

        try {
            statsListenerRef.current?.stop();
            const statsListener = new IcecastMetadataStats(station.url, {
                onStats: async (stats) => {
                    if (stats?.icy?.StreamTitle) {
                        setCurrentTrack((prevState) => {
                            if (
                                stats.icy.StreamTitle === prevState.StreamTitle ||
                                (prevState.stationId === sid &&
                                    prevState.stationId !== null)
                            ) {
                                return prevState;
                            }
                            return {
                                ...DEFAULT_TRACK,
                                StreamTitle: stats.icy.StreamTitle,
                                stationId: sid,
                                artworkURL: thumb,
                            };
                        });
                    }
                },
                onError: (error) => {
                    console.error("Error fetching stats:", error);
                },
                interval: 5,
                sources: ["icy", "ogg"],
            });
            statsListenerRef.current = statsListener;
            statsListener.start();
        } catch (error) {
            console.error("Error fetching stations:", error);
        }

        return () => {
            statsListenerRef.current?.stop();
            statsListenerRef.current = null;
        };
    }, [station?.id, station?.url, playerState]);

// Fetch tracks from the station
    const fetchTracks = async () => {
        if (!station) {
            return null;
        }
        try {
            const response = await fetch(`/api/station/${station.id}/tracks?v=` + new Date().getTime().toString());
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to fetch tracks");
            }
            return (data && data.currentPlaying) && data.currentPlaying;
        } catch (error) {
            console.error("Error fetching tracks:", error);
        }
        return null;
    };

// Fetch Spotify access token
    const getSpotifyAccessToken = async () => {
        const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_SECRET;
        console.log(clientId, clientSecret);
        const tokenURL = "https://accounts.spotify.com/api/token";

        const response = await fetch(tokenURL, {
            method: "POST", headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
            }, body: "grant_type=client_credentials",
        });

        if (!response.ok) {
            throw new Error("Failed to fetch Spotify token");
        }

        const data = await response.json();
        return data.access_token;
    };

// Fetch additional metadata for the track
    const getAdditionalMetadata = async (track) => {
        setCurrentTrack((prevState) => ({
            ...prevState,
            loaded: true,
        }));
        if (!track.StreamTitle) return;
        const [artistName, trackName] = track.StreamTitle.split(" - ");
        let trackData = {
            artistId: null,
            trackId: null,
            trackName: trackName || track.StreamTitle,
            artistName: artistName || "",
            artistImage: station?.thumbnail,
        };
        if (track.StreamTitle.trim().toLowerCase() !== "unknown") {
            const trackDataSpotify = await getSpotifyData(track);
            const ArtistImageSpotify = await getArtistImageFromSpotify(trackDataSpotify);
            if (trackDataSpotify && ArtistImageSpotify) {
                trackData = {
                    ...trackDataSpotify,
                    artworkURL: trackDataSpotify.artworkUrl100?.replace("100x100", "600x600") || trackDataSpotify.artworkUrl100,
                    artistImage: ArtistImageSpotify || station?.thumbnail,
                };
            } else {
                const trackDataApple = await getAppleData(track);
                const ArtistImageApple = await getArtistImageFromApple(trackDataApple?.artistViewUrl);
                if (trackDataApple) {
                    trackData = {
                        ...trackDataApple,
                        artworkURL: trackDataApple.artworkUrl100?.replace("100x100", "600x600") || station?.thumbnail,
                        artistImage: ArtistImageApple || station?.thumbnail,
                    };
                }
            }
        }
        setCurrentTrack((prevState) => ({
            ...prevState,
            ...trackData,
            metaDataFound: true,
            processed: true,
        }));
    };

    const getNewArtistImage = async (trackData) => {
        if (!trackData?.artistViewUrl) {
            return null;
        }
        try {
            const response = await fetch("/api/artist", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    artistId: trackData.artistId,
                    url: trackData.artistViewUrl,
                }),
            });
            const data = await response.json();
            return (response.ok) && data.artistImage;
        } catch (error) {
            console.error("There was a problem fetching the data:", error);
        }
        return null;
    }

    const getAppleData = async (track) => {
        try {
            const processText = processSongInfo(track.StreamTitle);
            const encodedSearchText = encodeURIComponent(processText);
            const iTunesSearchURL = `/itunes-api/search?term=${encodedSearchText}&limit=10`;
            const response = await fetch(iTunesSearchURL);
            const json = await response.json();
            return (json.results) && getTrack(json.results, processText);
        } catch (error) {
            console.log("There was a problem fetching the data:", error);
        }
        console.log("getAppleData - null");
        return null;
    }

    const getArtistImageFromApple = async (artistViewUrl) => {
        if (!artistViewUrl) {
            return null;
        }
        try {
            const response = await fetch(
              artistViewUrl.replace(
                "https://music.apple.com/us/artist/",
                "/apple-music/"
              )
            );
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(
              html,
              "text/html"
            );
            const artistImageElement = doc.querySelector(
              "main picture source"
            );
            return (artistImageElement) && artistImageElement
              .getAttribute("srcset")
              .split(" ")[0]
              .replace(
                /\d{1,4}x\d{1,4}/,
                "1280x1280"
              );
        } catch (error) {
            console.log("There was a problem fetching the data:", error);
        }
        console.log("getArtistImageFromApple - null");
        return null;
    }

    const getSpotifyData = async (track) => {
        try {
            const accessToken = await getSpotifyAccessToken();
            const metaArray = track.StreamTitle.split(" - ");
            const searchText = metaArray[1]?.trim().toLowerCase() === "unknown" ? "" : `track:${metaArray[1]}`;
            const b1 = metaArray[0].trim().toLowerCase() === "unknown" ? "" : `artist:${metaArray[0]}`;
            const processText = processSongInfo(`${searchText} ${b1}`);
            const encodedSearchText = encodeURIComponent(processText);
            const spotifySearchURL = `https://api.spotify.com/v1/search?q=${encodedSearchText}&type=track&limit=10`;
            const response = await fetch(spotifySearchURL, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            const json = await response.json();
            const spotifyTracks = json.tracks.items.map((item) => ({
                artistId: item.artists[0]?.id || null,
                artistName: item.artists[0]?.name || null,
                artistImage: item.artists[0]?.images?.[0]?.url || station?.thumbnail,
                artistViewUrl: item.artists[0]?.external_urls?.spotify || null,
                artworkUrl30: item.album.images[2]?.url || null,
                artworkUrl60: item.album.images[1]?.url || null,
                artworkUrl100: item.album.images[0]?.url || null,
                collectionExplicitness: item.explicit ? "explicit" : "notExplicit",
                collectionId: item.album.id || null,
                collectionName: item.album.name || null,
                collectionViewUrl: item.album.external_urls?.spotify || null,
                discNumber: item.disc_number || 1,
                isStreamable: true,
                kind: "song",
                previewUrl: item.preview_url || null,
                releaseDate: item.album.release_date || null,
                trackCensoredName: item.name || null,
                trackCount: item.album.total_tracks || 1,
                trackExplicitness: item.explicit ? "explicit" : "notExplicit",
                trackId: item.id || null,
                trackName: item.name || null,
                trackNumber: item.track_number || null,
                trackTimeMillis: item.duration_ms || null,
                trackViewUrl: item.external_urls?.spotify || null,
                wrapperType: "track",
            }));
            const trackData = getTrack(spotifyTracks, processText) || spotifyTracks[0] || null;
            return (trackData) && trackData;
        } catch (error) {
            console.log("There was a problem fetching the data:", error);
        }
        console.log("getSpotifyData - null");
        return null;
    }

    const getArtistImageFromSpotify = async (trackData) => {
        if (!trackData?.artistId) {
            return null
        }
        try {
            const accessToken = await getSpotifyAccessToken();
            const response = await fetch(
              `https://api.spotify.com/v1/artists/${trackData.artistId}`, {
                  headers: {
                      Authorization: `Bearer ${accessToken}`,
                  },
              });
            const data = await response.json();
            return (data.images.length > 0) && data.images[0].url.replace(/\d{1,4}x\d{1,4}/, "1280x1280");
        } catch (error) {
            console.log("There was a problem fetching the data:", error);
        }
        console.log("getArtistImageFromSpotify - null");
        return null;
    }

    return (
        <PlayerContext.Provider
            value={{
                player,
                playerState,
                playerVolume,
                setPlayerIsLoaded,
                changeVolume,
                currentTrack,
                listeners
            }}
        >
            {children}
        </PlayerContext.Provider>
    );
};
