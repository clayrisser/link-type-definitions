import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import pkg from 'npm-pkg-json';
import pkgDir from 'pkg-dir';
import { Command, flags } from '@oclif/command';
import { oc } from 'ts-optchain.macro';
import { install } from '../util';

const modulePath = pkgDir.sync(require.resolve(pkg.name)) || process.cwd();
const rootPath = modulePath.replace(/\/node_modules\/.+$/, '');
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
    const pkg = await import(path.resolve(modulePath, 'package.json'));
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
