"use client";

import { Fragment, useContext, useEffect, useState } from "react";

import Player from "@/components/Player";
import Navbar from "@/components/Navbar";
import MobileBanner from "@/components/mobile-banner";
import useIsMobile from "@/hooks/useIsMobile";
import { StationContext } from "@/context/station";
import { PlayerContext } from "@/context/player";
import { GoogleTagManager } from "@next/third-parties/google";
import Head from "next/head";



const StationContainer = () => {
  const isMobile = useIsMobile();
  const { station } = useContext(StationContext);
  const { listeners } = useContext(PlayerContext);

  const noPortUrl = station?.originalUrl?.replace(/^https?:\/\//, '');
  const stationListeners = listeners?.[noPortUrl]?.listeners ?? 1;

  useEffect(() => {
    if (station?.analytics) {
      // Regex to match script tags
      const scriptTagRegex = /<script.*?>([\s\S]*?)<\/script>/g;

      let match;
      let scriptsArray = [];
      while ((match = scriptTagRegex.exec(station.analytics)) !== null) {
        const scriptContent = match[1].trim();
        const scriptElement = document.createElement("script");

        if (scriptContent) {
          scriptElement.textContent = scriptContent;
        } else {
          // Extract the 'src' attribute from the script tag
          const srcMatch = match[0].match(/src="(.*?)"/);
          if (srcMatch) {
            scriptElement.src = srcMatch[1];
            scriptElement.async = true; // Add 'async' attribute if present
          }
        }

        // Append the script element to the document head or body
        document.head.appendChild(scriptElement);
        scriptsArray.push(scriptElement);
      }

      return () => {
        // Remove all the dynamically added script elements
        scriptsArray.forEach((scriptElement) => {
          scriptElement.remove();
        });
        scriptsArray = [];
      };
    }
  }, [station]);

  return (
    <Fragment>
      {station && station.gtm && <GoogleTagManager gtmId={station.gtm} />}
      <div
        className="relative w-full flex flex-col items-center"
        style={{
          backgroundImage: `url(${station ? station.backgroundImage : ""})`,
        }}
      >
        <div
          className={`absolute left-0 right-0 bottom-0 w-full h-[60%] bg-[#121212] md:h-[17%]`}
        ></div>
        {isMobile && <MobileBanner />}
        <Navbar station={station} />

        <div className="relative w-full z-10 flex flex-col justify-center max-w-screen-2xl">
          <Player />
        </div>
        {/*
        <div className="z-50 w-full -mt-6 border-b border-white/[.15] pb-4 lg:flex lg:justify-center lg:items-center lg:mt-6">
            <a
              target="_blank"
              className="ml-5 font-medium text-white md:ml-12 lg:ml-0"
              href="#"
            >
            {station?.name || ""} - Active({stationListeners})
            </a>
          </div>
          */}
      </div>
    </Fragment>
  );
};

export default StationContainer;
