import execa from 'execa';
import fs from 'fs-extra';
import globby from 'globby';
import ora from 'ora';
import os from 'os';
import path from 'path';
import pkgDir from 'pkg-dir';
import pkg from '../package.json';

const packageName = pkg.name;
const packageVersion = pkg.version;

export interface Pkg {
  linkTypeDefinitions: string[];
  [key: string]: any;
}

export interface LinkTypeDefinitionsOptions {
  copy: boolean;
  cwd: string;
  dryRun: boolean;
  moduleName?: string;
  save: boolean;
  typesLocation: string;
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
    copy: false,
    cwd: process.cwd(),
    dryRun: false,
    save: false,
    typesLocation: '',
    unlink: false,
    verbose: false,
    ...partialOptions
  };
  try {
    const pkgOptions = require(path.resolve(options.cwd, 'package.json'))?.[
      packageName
    ];
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
  const rootPath = (await pkgDir(path.resolve(options.cwd))) || options.cwd;
  if (!options.typesLocation.length) {
    if (await fs.pathExists(path.resolve(rootPath, 'src'))) {
      options.typesLocation = path.resolve(options.cwd, 'src/@types/_');
    } else {
      options.typesLocation = path.resolve(options.cwd, '@types/_');
    }
  }
  const typesLocationPath = path.resolve(rootPath, options.typesLocation);
  const pkgPath = path.resolve(rootPath, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return;
  let pkg: Pkg | void;
  try {
    pkg = require(pkgPath);
  } catch (err) {}
  if (!pkg) return;
  let { linkTypeDefinitions } = pkg;
  if (options.moduleName) linkTypeDefinitions = [options.moduleName];
  if (options) if (!linkTypeDefinitions) return;
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
      if (!dependencies.has(moduleName) && !options.unlink) {
        if (options.save && options.moduleName) {
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
      const modulePath = path.resolve(rootPath, 'node_modules', moduleName);
      const definitionsPath = await findDefinitionsPath(modulePath);
      await Promise.all(
        (await globby(path.resolve(definitionsPath, '**/*.d.ts?(x)'))).map(
          async (globPath: string) => {
            const relativeGlobPath = globPath.slice(definitionsPath.length + 1);
            if (!options.dryRun) {
              await fs.remove(
                path.resolve(typesLocationPath, moduleName, relativeGlobPath)
              );
            }
            if (options.unlink) {
              if (options.dryRun || options.verbose) {
                spinner.fail(
                  `${path.resolve(
                    typesLocationPath,
                    moduleName,
                    relativeGlobPath
                  )}`
                );
              }
            } else {
              if (!options.dryRun) {
                await fs.mkdirs(path.resolve(typesLocationPath, moduleName));
                if (options.copy) {
                  await fs.copy(
                    path.resolve(definitionsPath, relativeGlobPath),
                    path.resolve(
                      typesLocationPath,
                      moduleName,
                      relativeGlobPath
                    )
                  );
                } else {
                  await fs.symlink(
                    path.resolve(definitionsPath, relativeGlobPath),
                    path.resolve(
                      typesLocationPath,
                      moduleName,
                      relativeGlobPath
                    ),
                    'file'
                  );
                }
              }
              if (options.dryRun || options.verbose) {
                spinner.info(
                  `${path.resolve(definitionsPath, relativeGlobPath)} ${
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
    })
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
    const pkgOptions = require(path.resolve(options.cwd, 'package.json'))?.[
      packageName
    ];
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
  let relativeTypesLocation = options.typesLocation;
  if (!options.typesLocation.length) {
    if (await fs.pathExists(path.resolve(rootPath, 'src'))) {
      relativeTypesLocation = 'src/@types/_';
      options.typesLocation = path.resolve(options.cwd, relativeTypesLocation);
    } else {
      relativeTypesLocation = '@types/_';
      options.typesLocation = path.resolve(options.cwd, relativeTypesLocation);
    }
  }
  const pkgPath = path.resolve(rootPath, 'package.json');
  const gitignorePath = path.resolve(rootPath, '.gitignore');
  if (!(await fs.pathExists(pkgPath))) return false;
  let pkg: Pkg | void;
  try {
    pkg = require(pkgPath);
  } catch (err) {}
  if (!pkg) return false;
  const { linkTypeDefinitions, scripts } = pkg;
  if (linkTypeDefinitions || pkg[packageName]) {
    spinner.warn(`project already setup with ${packageName}`);
    return false;
  }
  pkg.linkTypeDefinitions = [];
  pkg[packageName] = { typesLocation: relativeTypesLocation };
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
  if (!options.dryRun) {
    await fs.writeJson(pkgPath, pkg, { spaces: 2 });
    await fs.appendFile(gitignorePath, `\n/${relativeTypesLocation}\n`);
  }
  if (options.dryRun || options.verbose) {
    spinner.info(`updated ${pkgPath}`);
    spinner.info(`updated ${gitignorePath}`);
  }
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

interface DefinitionsPathHashMap {
  [key: string]: string[];
}
