import ora from 'ora';
import path from 'path';
import pkgDir from 'pkg-dir';
import { Command, flags } from '@oclif/command';
import { oc } from 'ts-optchain.macro';
import { install } from '../util';

const rootPath = pkgDir.sync(process.cwd()) || process.cwd();

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
    await Promise.all(
      Object.entries(oc(pkg).typeDefinitions({})).map(
        async ([key, value]: [string, any]) => {
          spinner.start(`installing ${key}@${value}`);
          await install(key, value);
          spinner.start(`installed ${key}@${value}`);
        }
      )
    );
    spinner.succeed('installed type definitions');
  }
}
