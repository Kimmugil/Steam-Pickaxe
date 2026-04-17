"use client";
import { useState, useRef } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  placement?: "top" | "bottom";
}

export default function Tooltip({ content, children, placement = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          className={`absolute z-50 whitespace-pre-wrap w-64 text-xs bg-bg-card border border-border-default text-text-secondary rounded-lg px-3 py-2 shadow-xl pointer-events-none
            ${placement === "top" ? "bottom-full mb-2 left-1/2 -translate-x-1/2" : "top-full mt-2 left-1/2 -translate-x-1/2"}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export function InfoIcon({ tooltip }: { tooltip: string }) {
  return (
    <Tooltip content={tooltip}>
      <span className="ml-1 cursor-help text-text-muted hover:text-text-secondary text-xs">(?)</span>
    </Tooltip>
  );
}
