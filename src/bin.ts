import { run } from '@oclif/command';
import { handle as handleError } from '@oclif/errors/lib/handle';

(async () => {
  try {
    await run();
  } catch (err) {
    handleError(err);
  }
})();
