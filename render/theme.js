// Colors for the two themes. Every renderer receives a theme name ('light' or 'dark').
export const THEMES = {
  light: {
    bg: '#ffffff',
    text: '#1f2328',
    muted: '#656d76',
    border: '#d0d7de',
    card: '#f6f8fa',
    commits: '#2da44e',
    prs: '#8250df',
    issues: '#bf8700',
    reviews: '#0969da',
    up: '#1a7f37',
    down: '#cf222e',
    flat: '#656d76',
    heat: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  },
  dark: {
    bg: '#0d1117',
    text: '#e6edf3',
    muted: '#8d96a0',
    border: '#30363d',
    card: '#161b22',
    commits: '#3fb950',
    prs: '#a371f7',
    issues: '#d29922',
    reviews: '#58a6ff',
    up: '#3fb950',
    down: '#f85149',
    flat: '#8d96a0',
    heat: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
  },
};

export function getTheme(name) {
  return THEMES[name] || THEMES.light;
}
