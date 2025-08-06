import { router } from '../trpc';
import { getByClerkId } from './get-by-clerk-id';

export const userRouter = router({
  getByClerkId: getByClerkId,
});
