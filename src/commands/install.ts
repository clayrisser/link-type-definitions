import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import pkgDir from 'pkg-dir';
import { Command, flags } from '@oclif/command';
import { oc } from 'ts-optchain.macro';
import { install } from '../util';

export function getDefinitionsPath(cwd: string): string {
  const nodeModulesPath = path.resolve(cwd, '../../node_modules');
  if (
    fs.existsSync(nodeModulesPath) &&
    fs.lstatSync(nodeModulesPath).isDirectory()
  ) {
    return getDefinitionsPath(path.resolve(cwd, '../../..'));
  }
  return pkgDir.sync(cwd) || cwd;
}

const rootPath = getDefinitionsPath(process.cwd());
const defintionsPath = path.resolve(rootPath, 'node_modules/@types/_');
const tmpPath = path.resolve(rootPath, '.tmp/tspm');

export default class Install extends Command {
  static description = 'install typescript definition package';

  static examples = [`$ tspm install @types/node`];

  static flags = {
    help: flags.help({ char: 'h' })
  };

  static args = [{ name: 'name' }];

  async run() {
    const spinner = ora();
    const pkg = await import(path.resolve(rootPath, 'package.json'));
    spinner.start('installing type definitions');
    await fs.remove(tmpPath);
    await fs.remove(defintionsPath);
    await Promise.all(
      Object.entries(oc(pkg).typeDefinitions({})).map(
        async ([key, value]: [string, any]) => {
          spinner.start(`installing ${key}@${value}`);
          await install(key, value);
          spinner.start(`installed ${key}@${value}`);
        }
      )
    );
    await fs.remove(tmpPath);
    spinner.succeed('installed type definitions');
  }
}
