import execa from 'execa';
import fs from 'fs-extra';
import globby from 'globby';
import ora from 'ora';
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

export async function linkTypeDefinitions(
  partialOptions: Partial<LinkTypeDefinitionsOptions> = {}
) {
  const spinner = ora();
  let options: LinkTypeDefinitionsOptions = {
    copy: false,
    cwd: process.cwd(),
    dryRun: false,
    typesLocation: '',
    unlink: false,
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
  const { linkTypeDefinitions } = pkg;
  if (!linkTypeDefinitions) return;
  await Promise.all(
    linkTypeDefinitions.map(async (moduleName: string) => {
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
  partialOptions: Partial<SetupOptions>
): Promise<boolean> {
  const spinner = ora();
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
    const p = execa('pnpm', ['install']);
    p.stdout?.pipe(process.stdout);
    await p;
  }
  return true;
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
