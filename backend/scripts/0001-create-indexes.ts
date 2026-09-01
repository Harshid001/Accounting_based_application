import { connectDatabase, disconnectDatabase, mongoose } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';

import '../src/models/user.model.js';
import '../src/models/session.model.js';
import '../src/models/client.model.js';
import '../src/models/complianceType.model.js';
import '../src/models/clientService.model.js';
import '../src/models/complianceItem.model.js';
import '../src/models/task.model.js';
import '../src/models/taskComment.model.js';
import '../src/models/document.model.js';
import '../src/models/documentRequest.model.js';
import '../src/models/message.model.js';
import '../src/models/notification.model.js';
import '../src/models/auditLog.model.js';
import '../src/models/jobRun.model.js';
import '../src/models/firmSettings.model.js';

const run = async (): Promise<void> => {
  await connectDatabase();
  const names = Object.keys(mongoose.models).sort();
  for (const name of names) {
    const model = mongoose.models[name];
    if (!model) continue;
    const dropped = await model.syncIndexes({ background: true });
    logger.info(
      { event: 'indexes.synced', model: name, droppedIndexes: dropped },
      `indexes synced for ${name}`,
    );
  }
  await disconnectDatabase();
};

run().catch((error: unknown) => {
  logger.fatal({ event: 'indexes.failed', err: error }, 'index creation failed');
  process.exitCode = 1;
});
