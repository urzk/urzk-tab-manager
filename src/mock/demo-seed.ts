import type { FakeSeed, FakeSeedTab } from "./fake-chrome";

type Shape = "circle" | "square" | "diamond" | "triangle";

/** Simple coloured shape as a URL-encoded SVG data URI. */
function icon(color: string, shape: Shape): string {
  const body = {
    circle: `<circle cx="8" cy="8" r="7" fill="${color}"/>`,
    square: `<rect x="1" y="1" width="14" height="14" rx="3" fill="${color}"/>`,
    diamond: `<path d="M8 1l7 7-7 7-7-7z" fill="${color}"/>`,
    triangle: `<path d="M8 1l7 14H1z" fill="${color}"/>`,
  }[shape];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const tab = (
  title: string,
  url: string,
  color: string,
  shape: Shape,
  extra: Partial<FakeSeedTab> = {},
): FakeSeedTab => ({ title, url, favIconUrl: icon(color, shape), ...extra });

export const demoSeed: FakeSeed = {
  currentWindowIndex: 0,
  windows: [
    {
      tabs: [
        tab(
          "Inbox - Example Mail",
          "https://mail.example.com/inbox",
          "#d9534f",
          "square",
          { pinned: true },
        ),
        tab(
          "Team Calendar - Example Workspace",
          "https://calendar.example.com/week",
          "#4285f4",
          "square",
          { pinned: true },
        ),
        tab(
          "Getting Started - Example Docs",
          "https://docs.example.com/getting-started",
          "#2e7d32",
          "circle",
        ),
        tab(
          "API Reference: Tabs and Windows - Example Docs",
          "https://docs.example.com/api/tabs",
          "#2e7d32",
          "circle",
        ),
        tab(
          "Release Notes 2.4 - Example Docs",
          "https://docs.example.com/releases/2-4",
          "#2e7d32",
          "circle",
          { discarded: true },
        ),
        tab(
          "Pull Request #482: Faster tab search - Example Code",
          "https://code.example.com/acme/tabs/pull/482",
          "#6f42c1",
          "diamond",
        ),
        tab(
          "Issue #517: Restore pinned tabs on startup - Example Code",
          "https://code.example.com/acme/tabs/issues/517",
          "#6f42c1",
          "diamond",
        ),
        tab(
          "Build pipeline: main - Example CI",
          "https://ci.example.net/acme/tabs/main",
          "#f0ad4e",
          "triangle",
          { discarded: true },
        ),
        tab(
          "Designing calm interfaces - Example Journal",
          "https://journal.example.org/calm-interfaces",
          "#17a2b8",
          "square",
        ),
        tab(
          "Keyboard shortcuts cheat sheet - Example Docs",
          "https://docs.example.com/shortcuts",
          "#2e7d32",
          "circle",
        ),
        tab(
          "Weekly planning board - Example Boards",
          "https://boards.example.net/planning",
          "#e83e8c",
          "diamond",
        ),
        tab(
          "Sprint retrospective notes - Example Notes",
          "https://notes.example.org/retro",
          "#fd7e14",
          "square",
        ),
      ],
    },
    {
      tabs: [
        tab(
          "Morning headlines - Example Daily News",
          "https://news.example.com/today",
          "#c0392b",
          "square",
        ),
        tab(
          "City council approves new bike lanes - Example Daily News",
          "https://news.example.com/local/bike-lanes",
          "#c0392b",
          "square",
        ),
        tab(
          "Markets close higher on calm trading - Example Business",
          "https://business.example.org/markets",
          "#34495e",
          "triangle",
        ),
        tab(
          "Ten minutes of stretching for desk workers - Example Health",
          "https://health.example.net/stretching",
          "#27ae60",
          "circle",
          { discarded: true },
        ),
        tab(
          "Local weather: clear skies this weekend",
          "https://weather.example.com/forecast",
          "#3498db",
          "circle",
        ),
        tab(
          "Opinion: The case for slower mornings - Example Daily News",
          "https://news.example.com/opinion/slow-mornings",
          "#c0392b",
          "square",
        ),
        tab(
          "Science briefing: new coral reef survey - Example Science",
          "https://science.example.org/coral-survey",
          "#16a085",
          "diamond",
        ),
      ],
    },
    {
      tabs: [
        tab(
          "Weeknight lemon pasta recipe - Example Kitchen",
          "https://kitchen.example.com/recipes/lemon-pasta",
          "#f39c12",
          "circle",
        ),
        tab(
          "Three-day itinerary: coastal towns - Example Travel",
          "https://travel.example.org/coastal-itinerary",
          "#2980b9",
          "triangle",
        ),
        tab(
          "Sourdough starter troubleshooting - Example Kitchen",
          "https://kitchen.example.com/guides/sourdough",
          "#f39c12",
          "circle",
          { discarded: true },
        ),
        tab(
          "Packing list for a long weekend - Example Travel",
          "https://travel.example.org/packing-list",
          "#2980b9",
          "triangle",
        ),
        tab(
          "Trail map: Foxglove Ridge loop - Example Outdoors",
          "https://outdoors.example.net/trails/foxglove-ridge",
          "#8e5b2d",
          "diamond",
        ),
      ],
    },
  ],
};
