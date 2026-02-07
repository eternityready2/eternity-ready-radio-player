import { Inter } from "next/font/google";
import { headers } from "next/headers";
import Script from 'next/script';
import { StationProvider } from "@/context/station";
import { PlayerProvider } from "@/context/player";

import StationContainer from "@/components/station-container";
import Stations from "@/components/Stations";
import LastPlayed from "@/components/LastPlayed";
import StreamOnDemand from "@/components/StreamOnDemand";
import NewThisWeek from "@/components/NewThisWeek";
import Footer from "@/components/Footer";

import "@/styles/globals.css";
import Advertisements from "@/components/advertisements";
import GoogleAdsense from "@/components/google-adsense";
import UpNext from "@/components/up-next";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Eternity Ready Radio Player",
  description: "Eternity Ready Radio Player",
};

export default function RootLayout({ children }) {
  const adminRequestHeaders = headers().get("admin-url");

  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-TMFGS53Q');
          `}
        </Script>
      </head>
      <body className={inter.className}>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-TMFGS53Q"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <Script src="/js/global-exporter.js" strategy="beforeInteractive" />
        <Script src="https://eternityready.com/lib/constants.js" strategy="beforeInteractive" />
        <Script src="https://eternityready.com/lib/session.js" strategy="beforeInteractive" />
        <Script src="https://eternityready.com/lib/toast.js" strategy="beforeInteractive" />
        <Script src="https://eternityready.com/lib/utils.js" strategy="beforeInteractive" /> 
        {adminRequestHeaders ? (
          [children]
        ) : (
          <main>
            <StationProvider>
              <PlayerProvider>
                <main className="bg-[#121212] flex flex-col items-center">
                  <StationContainer />
                  <Stations />
                  <UpNext />
                  <LastPlayed />
                  <StreamOnDemand />
                  <Advertisements />
                  {/* <NewThisWeek /> */}
                </main>
                <eternity-salvation></eternity-salvation>
                <eternity-footer></eternity-footer>
                <Script src="https://eternityready.com/lib/eternityHeader.js" strategy="afterInteractive" />
                <Script src="https://eternityready.com/lib/eternitySalvation.js" strategy="afterInteractive" />
                <Script src="https://eternityready.com/lib/eternityFooter.js" strategy="afterInteractive" />

              </PlayerProvider>
            </StationProvider>
          </main>
        )}
        
      </body>
    </html>
  );
}
