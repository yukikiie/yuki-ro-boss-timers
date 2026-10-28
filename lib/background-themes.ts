export const BACKGROUND_ASPECT_RATIOS = Object.freeze({ desktop: 3, mobile: 4 / 3 });

const themes = [
  { id: "moon-garden", name: "Moon Garden Terraces", label: "月光庭園", description: "月色花園與層疊庭臺", desktop: "/art/backgrounds/moon-garden-desktop-soft-v2.png", mobile: "/art/backgrounds/moon-garden-mobile-soft-v2.png", desktopSize: [2172, 724], mobileSize: [1448, 1086] },
  { id: "mushroom-forest", name: "Giant Mushroom Forest", label: "巨菇森林", description: "大蘑菇與發光林間小徑", desktop: "/art/backgrounds/mushroom-forest-desktop-soft-v2.png", mobile: "/art/backgrounds/mushroom-forest-mobile-soft-v2.png", desktopSize: [2172, 724], mobileSize: [1447, 1087] },
  { id: "sky-islands", name: "Floating Sky Islands", label: "浮空島嶼", description: "天空島嶼與石橋冒險", desktop: "/art/backgrounds/sky-islands-desktop-soft-v2.png", mobile: "/art/backgrounds/sky-islands-mobile-soft-v2.png", desktopSize: [2172, 724], mobileSize: [1448, 1086] },
  { id: "crystal-cavern", name: "Crystal Cavern", label: "水晶洞窟", description: "巨大晶石與幽光洞窟", desktop: "/art/backgrounds/crystal-cavern-desktop-soft-v2.png", mobile: "/art/backgrounds/crystal-cavern-mobile-soft-v2.png", desktopSize: [2172, 724], mobileSize: [1448, 1086] },
  { id: "cosmic-sanctuary", name: "Cosmic Sanctuary", label: "星河秘境", description: "星河森林與宇宙聖域", desktop: "/art/backgrounds/cosmic-sanctuary-desktop-soft-v2.png", mobile: "/art/backgrounds/cosmic-sanctuary-mobile-soft-v2.png", desktopSize: [2172, 724], mobileSize: [1448, 1086] },
] as const;

const panelColors = { "moon-garden": "#d9d5e3", "mushroom-forest": "#cedbd2", "sky-islands": "#d7e2ec", "crystal-cavern": "#66627e", "cosmic-sanctuary": "#566d80" } as const;

export const BACKGROUND_THEMES = Object.freeze(themes.map(theme => Object.freeze({ ...theme, panelColor: panelColors[theme.id], desktopSize: Object.freeze(theme.desktopSize), mobileSize: Object.freeze(theme.mobileSize) })));
export type BackgroundThemeId = typeof themes[number]["id"];

export function resolveBackgroundTheme(value: unknown) {
  return BACKGROUND_THEMES.find(theme => theme.id === value) ?? BACKGROUND_THEMES[0];
}
