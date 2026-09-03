import { Pipeline } from '@teambit/builder';
import { NodeEnv } from '@bitdev/node.node-env';
import { createAriadaTaskHandler } from '@ariada-integrations/bit-ariada';

export class AriadaNodeEnv extends NodeEnv {
  name = 'ariada-node-env';

  build() {
    return Pipeline.from([
      createAriadaTaskHandler({
        rendered: { rootDir: 'dist', page: 'index.html' },
        reportDir: 'artifacts/ariada',
        failOn: 'serious',
      }),
    ]);
  }
}

export default new AriadaNodeEnv();
