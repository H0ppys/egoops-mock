/**
 * 场景树快照（拆分自 mock/mock-egoops.mjs L97-102）
 * GET /api/v1/tet-snapshots/active
 */
import { json, now } from '../http-helpers.mjs';
import { TET } from '../tet-snapshot.mjs';

export async function handleTetSnapshotRoute(ctx) {
  const { res, p } = ctx;
  const m = ctx.method;

  // GET /api/v1/tet-snapshots/active
  if (m === 'GET' && p === '/api/v1/tet-snapshots/active') {
    return json(res, 200, {
      snapshot_id: 'mock-tet', received_at: now(), node_count: 6, is_active: true, snapshot_data: TET,
    });
  }

  return false;
}
