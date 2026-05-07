import { useState, useEffect } from "react";

interface ChartTheme {
  gridStroke:   string;
  axisTextFill: string;
  dotBgFill:    string;
}

const DARK: ChartTheme = {
  gridStroke:   "#2a2f45",
  axisTextFill: "#8b91a8",
  dotBgFill:    "#1e2130",
};

const LIGHT: ChartTheme = {
  gridStroke:   "#d5d9ec",
  axisTextFill: "#4a4f6a",
  dotBgFill:    "#ffffff",
};

/**
 * Recharts SVG 속성(stroke, fill 등)은 CSS 변수를 직접 지원하지 않으므로
 * data-theme 변경을 감지해 JS 값으로 색상을 반환합니다.
 */
export function useChartTheme(): ChartTheme {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const sync = () =>
      setIsDark(document.documentElement.getAttribute("data-theme") !== "light");
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  return isDark ? DARK : LIGHT;
}
