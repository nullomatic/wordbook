import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { globSync, Path } from 'glob';
import * as winston from 'winston';

const SOURCE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const logFormat = winston.format.printf(function (info) {
  return `${info.timestamp}-${info.level}: ${info.message}`;
});

export const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        logFormat
      ),
    }),
  ],
});

export function getFiles(pattern: string) {
  const paths: Path[] = globSync(pattern, {
    cwd: SOURCE_DIR,
    withFileTypes: true,
  });
  return paths.map((path) => ({ filename: path.name, path: path.fullpath() }));
}

export function getPath(suffix: string) {
  return join(SOURCE_DIR, suffix);
}
