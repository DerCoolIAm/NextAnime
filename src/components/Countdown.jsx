import React, { useEffect, useState } from "react";

export default function Countdown({ airingAt }) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    function updateCountdown() {
      const now = Date.now();
      const airingTime = airingAt * 1000;
      const diffMs = airingTime - now;

      if (diffMs <= 0) {
        setCountdown("Now airing");
        return;
      }

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diffMs / (1000 * 60)) % 60);
      const secs = Math.floor((diffMs / 1000) % 60);

      let parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (mins > 0) parts.push(`${mins}m`);
      if (secs > 0 && days === 0) parts.push(`${secs}s`);

      setCountdown(parts.join(" ") || "Less than a second");
    }

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [airingAt]);

  return <div style={{ fontSize: 12, color: "#ccc" }}>{countdown}</div>;
}
