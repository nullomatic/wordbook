import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { globSync, Path } from 'glob';
import * as winston from 'winston';
import YAML from 'yaml';
import { CompiledEntry } from './types';

const SOURCE_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
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

export function getFiles(glob: string): { filename: string; path: string }[] {
  if (glob.startsWith('/')) {
    glob = glob.slice(1);
  }
  const paths: Path[] = globSync(glob, {
    cwd: SOURCE_DIR,
    withFileTypes: true,
  });
  return paths
    .map((path) => ({ filename: path.name, path: path.fullpath() }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

export function join(...segments: string[]) {
  return path.join(...segments);
}

export function stream(path: string) {
  return fs.createReadStream(getPath(path));
}

export function isAbsolute(_path: string) {
  // Works better than `path.isAbsolute` because it doesn't
  // return `true` for '/some/relative/path'.
  return _path === path.resolve(_path);
}

export function getPath(...segments: string[]) {
  if (segments.length === 1 && isAbsolute(segments[0])) {
    return segments[0];
  }
  return join(SOURCE_DIR, ...segments);
}

export function makeDir(path: string) {
  fs.mkdirSync(getPath(path), { recursive: true });
}

export function readFile(path: string) {
  return fs.readFileSync(getPath(path), 'utf-8');
}

export function writeFile(data: any, ...segments: string[]) {
  fs.writeFileSync(getPath(...segments), data);
}

export function readJSON(path: string) {
  const file = fs.readFileSync(getPath(path), 'utf-8');
  return JSON.parse(file);
}

export function writeJSON(json: any, ...segments: string[]) {
  fs.writeFileSync(getPath(...segments), JSON.stringify(json, null, 2));
}

export function readYAML(path: string) {
  const file = fs.readFileSync(getPath(path), 'utf-8');
  return YAML.parse(file);
}

export function sortObj<T extends Record<string, any>>(obj: T): T {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      (acc as any)[key] = obj[key];
      return acc;
    }, {} as T);
}

export function doThing() {
  // TODO
  const files = getFiles('/data/compiled/*.json');
  let count = 0;
  for (const { path } of files) {
    logger.info(`In file ${path}`);
    const entries = readJSON(path);
    for (const word in entries) {
      const entry: CompiledEntry = entries[word];
      if (entry.isAnglish) {
        console.log(word);
      }
      // for (const pos in entry.pos) {
      //   if (entry.pos[pos as POS].origins.length > 1) {
      //     count++;
      //   }
      // }
    }
  }
  console.log(`origins to distill: ${count}`);
}
