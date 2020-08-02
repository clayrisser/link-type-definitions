import execa from 'execa';
import fs from 'fs-extra';
import globby from 'globby';
import newRegExp from 'newregexp';
import ora, { Ora } from 'ora';
import os from 'os';
import path from 'path';
import pkgDir from 'pkg-dir';
import pkg from '../package.json';

const packageName = pkg.name;
const packageVersion = pkg.version;

export interface Pkg {
  name: string;
  linkTypeDefinitions: string[];
  linkTypeDefinitionsOptions: Partial<LinkTypeDefinitionsOptions>;
  [key: string]: any;
}

export interface LinkTypeDefinitionsOptions {
  copy: boolean;
  cwd: string;
  dryRun: boolean;
  ignorePaths?: string[];
  moduleName?: string;
  ns: string;
  save: boolean;
  unlink: boolean;
  verbose: boolean;
}

export interface SetupOptions {
  cwd: string;
  dryRun: boolean;
  install: boolean;
  typesLocation: string;
  verbose: boolean;
}

export default async function linkTypeDefinitions(
  partialOptions: Partial<LinkTypeDefinitionsOptions> = {},
  spinner = ora()
) {
  let options: LinkTypeDefinitionsOptions = {
    copy: true,
    cwd: process.cwd(),
    dryRun: false,
    ns: `_${packageName}`,
    save: false,
    unlink: false,
    verbose: false,
    ...partialOptions
  };
  try {
    const pkgOptions = require(path.resolve(options.cwd, 'package.json'))
      ?.linkTypeDefinitionsOptions;
    delete pkgOptions.cwd;
    delete pkgOptions.moduleName;
    delete pkgOptions.save;
    delete pkgOptions.unlink;
    options = {
      ...options,
      ...pkgOptions,
      ...partialOptions
    };
  } catch (err) {}
  if (options.verbose) {
    spinner.info(`OPTIONS: ${JSON.stringify(options, null, 2)}`);
  }
  const rootPath = (await pkgDir(options.cwd)) || options.cwd;
  const installedFromPath = (await fs.pathExists(
    path.resolve(__dirname, '../../..', 'node_modules')
  ))
    ? path.resolve(__dirname, '../../..')
    : null;
  const typesLocationPath = path.resolve(
    rootPath,
    'node_modules/@types',
    options.ns
  );
  const pkgPath = path.resolve(rootPath, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return;
  let pkg: Pkg | void;
  try {
    pkg = require(pkgPath);
  } catch (err) {}
  if (!pkg) return;
  let { linkTypeDefinitions } = pkg;
  if (options.moduleName) linkTypeDefinitions = [options.moduleName];
  if (!linkTypeDefinitions.length) return;
  if (!options.dryRun && !options.moduleName) {
    await fs.remove(typesLocationPath);
  }
  await Promise.all(
    linkTypeDefinitions.map(async (moduleName: string) => {
      const dependencies = new Set(
        pkg
          ? [
              ...Object.keys(pkg?.dependencies || {}),
              ...Object.keys(pkg?.devDependencies || {})
            ]
          : []
      );
      if (
        moduleName.substr(0, 2) !== './' &&
        !dependencies.has(moduleName) &&
        !options.unlink
      ) {
        if (options.moduleName) {
          spinner.stop();
          spinner.fail(
            `cannot link unless '${moduleName}' is saved in dependencies or devDependencies in the package.json file`
          );
          process.exit(1);
        }
        spinner.stop();
        spinner.warn(
          `'${moduleName}' not saved in dependencies or devDependencies in the package.json file`
        );
        return;
      }
      if (pkg && options.save && options.moduleName) {
        if (!options.dryRun) {
          const linkTypeDefinitionsSet = new Set([
            ...(pkg.linkTypeDefinitions || []),
            ...linkTypeDefinitions
          ]);
          if (options.unlink) linkTypeDefinitionsSet.delete(options.moduleName);
          pkg.linkTypeDefinitions = [...linkTypeDefinitionsSet];
          await fs.writeJson(pkgPath, pkg, { spaces: 2 });
        }
        if (options.dryRun || options.verbose) {
          spinner.info(`updated ${pkgPath}`);
        }
      }
      if (moduleName.substr(0, 2) === './') {
        if (installedFromPath) {
          await linkGlob(
            path.resolve(installedFromPath, moduleName),
            options,
            typesLocationPath,
            path.resolve(...(pkg ? [pkg?.name] : []), moduleName),
            spinner
          );
        }
      } else if (!installedFromPath) {
        const modulePath = path.resolve(rootPath, 'node_modules', moduleName);
        const definitionsPath = await findDefinitionsPath(modulePath);
        await linkGlob(
          definitionsPath,
          options,
          typesLocationPath,
          moduleName,
          spinner
        );
      }
    })
  );
  if (!options.dryRun) {
    await writeLinkedDirectives(typesLocationPath, options.ns);
  }
}

export async function linkGlob(
  rootGlobPath: string,
  options: LinkTypeDefinitionsOptions,
  typesLocationPath: string,
  moduleName: string,
  spinner: Ora
) {
  await Promise.all(
    (await globby(path.resolve(rootGlobPath, '**/*.d.ts?(x)'))).map(
      async (globPath: string) => {
        const relativeGlobPath = globPath.slice(rootGlobPath.length + 1);
        if (
          (options.ignorePaths || []).reduce(
            (shouldIgnore: boolean, ignorePath: string) => {
              if (shouldIgnore) return shouldIgnore;
              if (newRegExp(ignorePath).test(globPath)) return true;
              return shouldIgnore;
            },
            false
          )
        ) {
          if (!options.dryRun) {
            await fs.remove(
              path.resolve(typesLocationPath, moduleName, relativeGlobPath)
            );
          }
          if (options.dryRun || options.verbose) {
            spinner.fail(
              `${path.resolve(typesLocationPath, moduleName, relativeGlobPath)}`
            );
          }
          return true;
        }
        if (!options.dryRun) {
          await fs.remove(
            path.resolve(typesLocationPath, moduleName, relativeGlobPath)
          );
        }
        if (options.unlink) {
          if (options.dryRun || options.verbose) {
            spinner.fail(
              `${path.resolve(typesLocationPath, moduleName, relativeGlobPath)}`
            );
          }
        } else {
          if (!options.dryRun) {
            await fs.mkdirs(path.resolve(typesLocationPath, moduleName));
            if (options.copy) {
              await fs.copy(
                path.resolve(rootGlobPath, relativeGlobPath),
                path.resolve(typesLocationPath, moduleName, relativeGlobPath)
              );
            } else {
              await fs.symlink(
                path.resolve(rootGlobPath, relativeGlobPath),
                path.resolve(typesLocationPath, moduleName, relativeGlobPath),
                'file'
              );
            }
          }
          if (options.dryRun || options.verbose) {
            spinner.info(
              `${path.resolve(rootGlobPath, relativeGlobPath)} ${
                options.copy ? '=>' : '->'
              } ${path.resolve(
                typesLocationPath,
                moduleName,
                relativeGlobPath
              )}`
            );
          }
        }
      }
    )
  );
}

export async function setup(
  partialOptions: Partial<SetupOptions>,
  spinner = ora()
): Promise<boolean> {
  let options: SetupOptions = {
    cwd: process.cwd(),
    dryRun: false,
    install: true,
    typesLocation: '',
    verbose: false,
    ...partialOptions
  };
  try {
    const pkgOptions = require(path.resolve(options.cwd, 'package.json'))
      ?.linkTypeDefinitionsOptions;
    options = {
      ...options,
      ...pkgOptions,
      ...partialOptions
    };
  } catch (err) {}
  if (options.verbose) {
    spinner.info(`OPTIONS: ${JSON.stringify(options, null, 2)}`);
  }
  const rootPath = (await pkgDir(path.resolve(options.cwd))) || options.cwd;
  const pkgPath = path.resolve(rootPath, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return false;
  let pkg: Pkg | void;
  try {
    pkg = require(pkgPath);
  } catch (err) {}
  if (!pkg) return false;
  const { linkTypeDefinitions, scripts } = pkg;
  if (linkTypeDefinitions || pkg.linkTypeDefinitionsOptions) {
    spinner.warn(`project already setup with ${packageName}`);
    return false;
  }
  pkg.linkTypeDefinitions = [];
  let postinstall = `${packageName} link`;
  if (scripts?.postinstall?.length) {
    postinstall = `${scripts.postinstall} && ${postinstall}`;
  }
  pkg = {
    ...pkg,
    scripts: {
      ...(pkg.scripts || {}),
      postinstall
    },
    devDependencies: {
      ...(pkg.devDependencies || {}),
      [packageName]: `^${packageVersion}`
    }
  };
  if (!options.dryRun) await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  if (options.dryRun || options.verbose) spinner.info(`updated ${pkgPath}`);
  if (options.install) {
    const npm = await getNpm();
    await execa(npm, ['install'], { stdio: 'inherit' });
  }
  return true;
}

async function getNpm(
  npms = ['pnpm', 'yarn', 'npm', 'chipchop']
): Promise<string> {
  const foundNpms: Set<string> = new Set();
  await Promise.all(
    npms.map(async (npm: string) => {
      const isWin = os.platform().indexOf('win') > -1;
      const where = isWin ? 'where' : 'which';
      try {
        const p = await execa(where, [npm]);
        if (!p.exitCode) foundNpms.add(npm);
      } catch (err) {}
    })
  );
  return (
    npms.reduce((foundNpm: string | null, npm: string) => {
      if (foundNpm) return foundNpm;
      if (foundNpms.has(npm)) return npm;
      return foundNpm;
    }, null) || 'npm'
  );
}

export async function findDefinitionsPath(modulePath: string): Promise<string> {
  const definitionsPathsHashMap = (
    await globby(path.resolve(modulePath, '**/*.d.ts?(x)'))
  ).reduce(
    (definitionsPathsHashMap: DefinitionsPathHashMap, globPath: string) => {
      const globPathArray = globPath.split('/');
      const key = (globPathArray.length - 1).toString();
      const definitionsPaths = definitionsPathsHashMap[key] || [];
      definitionsPaths.push(
        globPathArray.slice(0, globPathArray.length - 1).join('/')
      );
      definitionsPathsHashMap[key] = definitionsPaths;
      return definitionsPathsHashMap;
    },
    {}
  );
  const definitionsPaths =
    definitionsPathsHashMap[
      Math.min(
        ...Object.keys(definitionsPathsHashMap).map((key: string) =>
          Number(key)
        )
      ).toString()
    ];
  if (definitionsPaths.length === 1) return definitionsPaths[0];
  const defintionsPathArray = definitionsPaths[0].split('/');
  return defintionsPathArray.slice(0, defintionsPathArray.length - 1).join('/');
}

export async function writeLinkedDirectives(
  typesLocationPath: string,
  ns: string
) {
  const relativeTypePathsSet = new Set(
    (await globby(path.resolve(typesLocationPath, '**/*.d.ts'))).map(
      (typePath: string) => {
        return typePath.slice(typesLocationPath.length + 1);
      }
    )
  );
  relativeTypePathsSet.delete('index.d.ts');
  const relativeTypePaths = [...relativeTypePathsSet];
  const linkedDirectives = createLinkedDirectives(relativeTypePaths, ns);
  await fs.mkdirs(typesLocationPath);
  await fs.writeFile(
    path.resolve(typesLocationPath, 'index.d.ts'),
    linkedDirectives
  );
}

export function createLinkedDirectives(filePaths: string[], ns = '_'): string {
  return [
    ...filePaths.map(
      (filePath: string) => `/// <reference path="${filePath}" />`
    ),
    `declare module '${ns}' {}`
  ].join('\n');
}

interface DefinitionsPathHashMap {
  [key: string]: string[];
}
