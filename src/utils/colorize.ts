export const colorize = (color: string, text: string) => {
  const colorCode = Bun.color(color, "ansi");
  return `${colorCode}${text}\x1b[0m`;
};
