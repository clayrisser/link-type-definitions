import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import pkgDir from 'pkg-dir';
import tar from 'tar';
import { oc } from 'ts-optchain.macro';

const rootPath = pkgDir.sync(process.cwd()) || process.cwd();
const tmpPath = path.resolve(rootPath, '.tmp/tspm');
const defintionsPath = path.resolve(rootPath, 'src/@types/type_definitions');

export interface PackageInfo {
  name: string;
  url: string;
}

export async function getPackageInfo(
  key: string,
  value: string
): Promise<PackageInfo> {
  const res = await axios.get(`https://registry.npmjs.org/${key}`);
  return {
    name: oc(res).data.versions[value]({}).name,
    url: oc(res).data.versions[value].dist.tarball()
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

export async function install(key: string, value: string): Promise<boolean> {
  const { url, name } = await getPackageInfo(key, value);
  if (!url) return false;
  const filename = oc((url || '').match(/[^/]+$/))[0]('');
  if (!filename) return false;
  const currentTmpPath = path.resolve(
    tmpPath,
    `${key}-${value}`.replace(/[/@]/g, '__')
  );
  const tarPath = path.resolve(currentTmpPath, filename);
  await fs.mkdirs(currentTmpPath);
  await download(url, tarPath);
  await tar.x({ file: tarPath, cwd: currentTmpPath });
  const nameArray = name.split('/');
  await fs.mkdirs(defintionsPath);
  const destinationPath = path.resolve(
    defintionsPath,
    key.replace(/[/@]/g, '__')
  );
  if (await fs.pathExists(destinationPath)) await fs.remove(destinationPath);
  await fs.rename(
    path.resolve(currentTmpPath, nameArray[nameArray.length - 1]),
    destinationPath
  );
  return true;
}
