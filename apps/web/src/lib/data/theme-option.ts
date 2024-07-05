/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

export interface ColorObject {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface ThemeOption {
  fontColor: string;
  backgroundColor: string;
  selectionFontColor: string;
  selectionBackgroundColor: string;
  hintFuriganaShadowColor: string;
  hintFuriganaFontColor: string;
  tooltipTextFontColor: string;
}

export interface CustomThemeValue {
  hexExpression: string;
  alphaValue: number;
  rgbaExpression: string;
}

function updateHintFuriganaFontColor(theme: Record<keyof ThemeOption, ColorObject>) {
  return {
    ...theme,
    hintFuriganaFontColor: {
      ...theme.fontColor,
      a: theme.fontColor.a ? theme.fontColor.a * 0.38 : 0.38
    }
  };
}

const lightTheme = updateHintFuriganaFontColor({
  fontColor: {
    r: 0x00,
    g: 0x00,
    b: 0x00,
    a: 0.87
  },
  backgroundColor: {
    r: 0xff,
    g: 0xff,
    b: 0xff
  },
  selectionFontColor: {
    r: 0xf5,
    g: 0xf5,
    b: 0xf5
  },
  selectionBackgroundColor: {
    r: 0x97,
    g: 0x97,
    b: 0x97
  },
  hintFuriganaFontColor: {
    r: 0x00,
    g: 0x00,
    b: 0x00
  },
  hintFuriganaShadowColor: {
    r: 34,
    g: 34,
    b: 49,
    a: 0.3
  },
  tooltipTextFontColor: {
    r: 0x00,
    g: 0x00,
    b: 0x00,
    a: 0.6
  }
});

const darkTheme = updateHintFuriganaFontColor({
  fontColor: {
    r: 0xff,
    g: 0xff,
    b: 0xff,
    a: 0.87
  },
  backgroundColor: {
    r: 0x23,
    g: 0x27,
    b: 0x2a
  },
  selectionFontColor: {
    r: 85,
    g: 90,
    b: 92,
    a: 0.6
  },
  selectionBackgroundColor: {
    r: 212,
    g: 217,
    b: 220,
    a: 0.8
  },
  hintFuriganaFontColor: {
    r: 0x00,
    g: 0x00,
    b: 0x00
  },
  hintFuriganaShadowColor: {
    r: 240,
    g: 240,
    b: 241,
    a: 0.3
  },
  tooltipTextFontColor: {
    r: 0xff,
    g: 0xff,
    b: 0xff,
    a: 0.6
  }
});

function themeObjValueToStringValue<T extends string>(objValue: Record<T, ColorObject>) {
  return Object.entries(objValue).reduce<Record<T, string>>((acc, [key, value]) => {
    const obj = value as ColorObject;
    acc[key as T] = `rgba(${obj.r}, ${obj.g}, ${obj.b}, ${obj.a ?? 1})`;
    return acc;
  }, {} as any);
}

const availableThemesCamelCase = {
  lightTheme,
  ecruTheme: {
    ...lightTheme,
    backgroundColor: {
      r: 0xf7,
      g: 0xf6,
      b: 0xeb
    }
  },
  waterTheme: {
    ...lightTheme,
    backgroundColor: {
      r: 0xdf,
      g: 0xec,
      b: 0xf4
    }
  },
  /**
   * Called gray theme for legacy reasons
   */
  grayTheme: darkTheme,
  /**
   * Called dark theme for legacy reasons
   */
  darkTheme: {
    ...darkTheme,
    fontColor: {
      r: 0xff,
      g: 0xff,
      b: 0xff,
      a: 0.6
    },
    backgroundColor: {
      r: 0x12,
      g: 0x12,
      b: 0x12
    }
  },
  blackTheme: {
    ...darkTheme,
    backgroundColor: {
      r: 0x00,
      g: 0x00,
      b: 0x00
    }
  }
};

function camelCaseToKebabCase(s: string) {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

export const availableThemes = new Map(
  Object.entries(availableThemesCamelCase).map(([key, value]) => [
    camelCaseToKebabCase(key),
    themeObjValueToStringValue(value)
  ])
);
