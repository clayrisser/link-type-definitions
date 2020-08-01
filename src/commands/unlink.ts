import Parser from '@oclif/parser';
import ora from 'ora';
import { Command, flags } from '@oclif/command';
import { Input } from '@oclif/command/lib/flags';
import linkTypeDefinitions from '..';

export default class UnlinkCommand extends Command {
  static description = 'unlink typescript definitions';

  static examples = ['$ link-type-definitions unlink @types/node'];

  static flags: Input<any> = {
    dry: flags.boolean({ char: 'd', required: false }),
    help: flags.help({ char: 'h', required: false }),
    save: flags.boolean({ char: 'S', required: false }),
    verbose: flags.boolean({ char: 'v', required: false })
  };

  static args: Parser.args.Input = [{ name: 'module', required: false }];

  async run() {
    const { flags, args } = this.parse(UnlinkCommand);
    const spinner = flags.dry ? undefined : ora();
    spinner?.[flags.verbose ? 'info' : 'start'](
      `unlinking type definitions${flags.verbose ? ' . . .' : ''}`
    );
    await linkTypeDefinitions(
      {
        ...(args.module ? { moduleName: args.module } : {}),
        ...(flags.dry ? { dryRun: flags.dry } : {}),
        ...(flags.save ? { save: flags.save } : {}),
        ...(flags.verbose ? { verbose: flags.verbose } : {}),
        unlink: true
      },
      spinner
    );
    spinner?.succeed('unlinked type definitions');
  }
}
