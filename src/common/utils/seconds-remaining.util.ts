export function getSecondsRemaining(
  createdAt: Date,
  waitTimeInSeconds: number = 60,
) {
  const elapsed = (Date.now() - createdAt.getTime()) / 1000;
  const remaining = Math.ceil(waitTimeInSeconds - elapsed);
  return remaining > 0 ? remaining : 0;
}
