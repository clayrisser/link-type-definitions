import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import pkgDir from 'pkg-dir';
import { Command, flags } from '@oclif/command';
import { oc } from 'ts-optchain.macro';
import { install } from '../util';

export default class PostInstall extends Command {
  static description = 'install typescript definition package';

  static examples = [`$ tspm install @types/node`];

  static flags = {
    help: flags.help({ char: 'h' })
  };

  static args = [{ name: 'PACKAGE', required: true }];

  async run() {
    const { args } = this.parse(PostInstall);
    const spinner = ora();
    const modulePath =
      pkgDir.sync(require.resolve(args.PACKAGE)) || process.cwd();
    const rootPath = modulePath.replace(/\/node_modules\/.+$/, '');
    const defintionsPath = path.resolve(rootPath, 'node_modules/@types/_');
    const tmpPath = path.resolve(rootPath, '.tmp/tspm');
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
