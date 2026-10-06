import { useColorScheme } from 'react-native';

const light = {
  dark: false,
  bg: '#FFFFFF',
  surface: '#F6F8FA',
  border: '#D0D7DE',
  text: '#1F2328',
  muted: '#59636E',
  accent: '#0969DA',
  danger: '#CF222E',
  onAccent: '#FFFFFF',
};

const dark: typeof light = {
  dark: true,
  bg: '#0D1117',
  surface: '#161B22',
  border: '#30363D',
  text: '#E6EDF3',
  muted: '#9198A1',
  accent: '#4493F8',
  danger: '#F85149',
  onAccent: '#FFFFFF',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
