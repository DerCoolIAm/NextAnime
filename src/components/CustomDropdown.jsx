import React, { useEffect, useRef } from "react";

export default function CustomDropdown({ label, value, options, onSelect, isOpen, toggleOpen }) {
  const ref = useRef();

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target) && isOpen) {
        toggleOpen(); // Close dropdown when clicking outside
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, toggleOpen]);

  return (
    <div ref={ref} style={{ position: "relative", fontSize: 14, color: "#fff" }}>
      <div
        onClick={toggleOpen}
        style={{
          backgroundColor: "#61dafb",
          color: "#000",
          padding: "4px 10px",
          borderRadius: 6,
          cursor: "pointer",
          minWidth: 60,
          userSelect: "none",
          boxShadow: "none",
        }}
      >
        {label}: {value}
      </div>
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "110%",
            left: 0,
            backgroundColor: "#333",
            borderRadius: 6,
            boxShadow: "0 0 10px rgba(0,0,0,0.5)",
            maxHeight: 150,
            overflowY: "scroll",
            scrollbarWidth: "none", // Firefox
            msOverflowStyle: "none", // IE 10+
            zIndex: 10,
            border: "3px solid #61dafb",
            padding: 4,
          }}
          // Hide scrollbar for Webkit browsers
          className="hide-scrollbar"
        >
          {options.map((opt) => (
            <div
              key={opt}
              onClick={() => {
                onSelect(opt);
                toggleOpen();
              }}
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                color: "#fff",
                backgroundColor: value === opt ? "#61dafb" : "transparent",
              }}
            >
              {opt}
            </div>
          ))}
          <style>{`
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
