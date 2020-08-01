import Parser from '@oclif/parser';
import ora from 'ora';
import { Command, flags } from '@oclif/command';
import { Input } from '@oclif/command/lib/flags';
import linkTypeDefinitions from '..';

export default class LinkCommand extends Command {
  static description = 'link typescript definitions';

  static examples = ['$ link-type-definitions link @types/node'];

  static flags: Input<any> = {
    dry: flags.boolean({ char: 'd', required: false }),
    help: flags.help({ char: 'h', required: false }),
    save: flags.boolean({ char: 'S', required: false }),
    symlink: flags.boolean({ required: false }),
    verbose: flags.boolean({ char: 'v', required: false })
  };

  static args: Parser.args.Input = [{ name: 'module', required: false }];

  async run() {
    const { flags, args } = this.parse(LinkCommand);
    const spinner = flags.dry ? undefined : ora();
    spinner?.[flags.verbose ? 'info' : 'start'](
      `linking type definitions${flags.verbose ? ' . . .' : ''}`
    );
    await linkTypeDefinitions(
      {
        ...(args.module ? { moduleName: args.module } : {}),
        ...(flags.dry ? { dryRun: flags.dry } : {}),
        ...(flags.save ? { save: flags.save } : {}),
        ...(flags.symlink ? { copy: false } : { copy: true }),
        ...(flags.verbose ? { verbose: flags.verbose } : {})
      },
      spinner
    );
    spinner?.succeed('linked type definitions');
  }
}
