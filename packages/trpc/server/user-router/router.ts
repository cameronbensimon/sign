import { router } from '../trpc';
import { getOrCreateByClerkId } from './get-or-create-by-clerk-id';

export const userRouter = router({
  getOrCreateByClerkId,
});
