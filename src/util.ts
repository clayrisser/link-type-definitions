import Url from 'url-parse';
import asyncCrossSpawn from 'async-cross-spawn';
import axios from 'axios';
import fs from 'fs-extra';
import glob from 'glob-promise';
import path from 'path';
import pkgDir from 'pkg-dir';
import tar from 'tar';
import { Clone } from 'nodegit';
import { oc } from 'ts-optchain.macro';

const modulePath = pkgDir.sync(process.cwd()) || process.cwd();
const rootPath = modulePath.replace(/\/node_modules\/.+$/, '');
const tmpPath = path.resolve(rootPath, '.tmp/tspm');
const defintionsPath = path.resolve(rootPath, 'node_modules/@types/_');
const { clone } = Clone;

export interface Paths {
  destination: string;
  tar: string;
  tmp: string;
  unpacked: string;
}

export interface PackageInfo {
  name: string;
  url: string;
}

export async function getPackageInfo(
  key: string,
  value: string
): Promise<PackageInfo> {
  let name = key;
  let url = null;
  const res = await axios
    .get(`https://registry.npmjs.org/${key}`)
    .catch(() => null);
  url = oc(res).data.versions[value].dist.tarball();
  if (url) {
    ({ name } = oc(res).data.versions[value]({}));
  } else {
    url = value;
  }
  return {
    name,
    url
  };
}

export async function download(url: string, filePath: string) {
  const writer = fs.createWriteStream(filePath);
  (await axios.get(url, {
    responseType: 'stream'
  })).data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

export function getPaths(
  key: string,
  pkgName: string,
  filename: string
): Paths {
  const currentTmpPath = path.resolve(tmpPath, key);
  const tarPath = path.resolve(currentTmpPath, filename);
  const pkgNameArray = pkgName.split('/');
  const destinationPath = path.resolve(
    defintionsPath,
    key.replace(/[/@]/g, '__')
  );
  const unpackedPath = path.resolve(
    currentTmpPath,
    pkgNameArray[pkgNameArray.length - 1]
  );
  return {
    tmp: currentTmpPath,
    tar: tarPath,
    destination: destinationPath,
    unpacked: unpackedPath
  };
}

export async function install(key: string, value: string): Promise<boolean> {
  const { url, name } = await getPackageInfo(key, value);
  const parsedUrl = new Url(url);
  const filename = oc((url || '').match(/[^/]+$/))[0]('');
  const paths = getPaths(key, name, filename);
  if (!url) return false;
  if (!filename) return false;
  await fs.mkdirs(paths.tmp);
  let isGit = false;
  if (
    parsedUrl.pathname.substr(parsedUrl.pathname.length - 4) === '.git' ||
    url.substr(0, 4) === 'git@' ||
    url.substr(0, 6) === 'ssh://'
  ) {
    isGit = true;
  }
  if (!isGit) {
    await download(url, paths.tar);
    try {
      await tar.x({ file: paths.tar, cwd: paths.tmp });
    } catch (err) {
      isGit = true;
    }
  }
  if (!(await fs.pathExists(paths.unpacked))) {
    paths.unpacked = path.resolve(paths.tmp, 'package');
  }
  if (isGit) {
    await fs.remove(paths.unpacked);
    await clone(parsedUrl.origin + parsedUrl.pathname, paths.unpacked);
    const branchName = oc(
      oc(parsedUrl.hash.split('::'))[0]('').match(/#(.+)/)
    )[1]();
    if (branchName) {
      await asyncCrossSpawn('git', ['checkout', `origin/${branchName}`], {
        cwd: paths.unpacked
      });
    }
  }
  if (!(await fs.pathExists(defintionsPath))) {
    await fs.mkdirs(defintionsPath);
    await fs.writeFile(path.resolve(defintionsPath, 'index.d.ts'), '');
  }
  if (await fs.pathExists(paths.destination)) {
    await fs.remove(paths.destination);
  }
  const subdirPath = oc(
    oc(parsedUrl.hash.split('::'))[1]('').match(/\/(.+)/)
  )[1]('');
  await fs.rename(path.resolve(paths.unpacked, subdirPath), paths.destination);
  await fs.appendFile(
    path.resolve(defintionsPath, 'index.d.ts'),
    (await glob(path.resolve(paths.destination, '**/*.d.ts'), {
      cwd: defintionsPath
    }))
      .map((definitionPath: string) => {
        return `/// <reference path=".${definitionPath.substr(
          defintionsPath.length
        )}" />`;
      })
      .join('\n')
  );
  return true;
}
