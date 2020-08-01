import Parser from '@oclif/parser';
import ora from 'ora';
import { Command, flags } from '@oclif/command';
import { Input } from '@oclif/command/lib/flags';
import { linkTypeDefinitions } from '..';

export default class LinkCommand extends Command {
  static description = 'link typescript definitions';

  static examples = ['$ tsdpm link @types/node'];

  static flags: Input<any> = {
    copy: flags.boolean({ char: 'c', required: false }),
    dry: flags.boolean({ char: 'd', required: false }),
    help: flags.help({ char: 'h', required: false }),
    location: flags.string({ char: 'l', required: false }),
    save: flags.string({ char: 'S', required: false }),
    verbose: flags.boolean({ char: 'v', required: false })
  };

  static args: Parser.args.Input = [{ name: 'module', required: false }];

  async run() {
    const { flags, args } = this.parse(LinkCommand);
    const spinner = flags.dry ? undefined : ora();
    spinner?.[flags.verbose ? 'info' : 'start'](
      `linking type definitions${flags.verbose ? ' . . .' : ''}`
    );
    await linkTypeDefinitions({
      ...(args.module ? { moduleName: args.module } : {}),
      ...(flags.copy ? { copy: flags.copy } : {}),
      ...(flags.dry ? { dryRun: flags.dry } : {}),
      ...(flags.location ? { typesLocation: flags.location } : {}),
      ...(flags.save ? { save: flags.save } : {}),
      ...(flags.verbose ? { verbose: flags.verbose } : {})
    });
    spinner?.succeed('linked type definitions');
  }
}
